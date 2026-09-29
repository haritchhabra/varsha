"""Monsoon "digital twin": synthetic observed rainfall and NWP forecasts with regime-dependent errors.

Why synthetic?  Operational NWP archives (NCUM / GFS-T1534 hindcasts) are not openly downloadable
inside a 24-hour hackathon.  The twin runs on the *real* 0.25 deg India grid, real ETOPO1 terrain,
real coastline and the official district map, and reproduces the documented error behaviour of
NWP over India, which is exactly what a regime-aware corrector must learn:

  ACTIVE      - monsoon trough rain placed too far north, heavy rain under-forecast
  BREAK       - spurious rain over central India (false alarms), foothill / NE rain under-forecast
  DEPRESSION  - track displaced (grows with lead), rain symmetric instead of SW-sector, too weak
  OROGRAPHIC  - Western Ghats windward rain under-forecast (smoothed terrain), spill-over to lee side
  WD          - rain pushed onto the plains, too weak over high terrain
  all         - drizzle bias (too many light-rain days), smoothing of extremes, lead-dependent noise

Swap `simulate_year` for a real loader (IMD 0.25 deg gridded obs + NWP on the same grid) and every
downstream module (features, regime classifier, correction, verification, export) runs unchanged.
"""
from dataclasses import dataclass, field

import numpy as np
from scipy import ndimage
from scipy.special import ndtr

from . import config as C
from .geo import Geo

ACT, BRK, DEP, ORO, WD, NOR = range(6)

# Mean regime duration (days) and transition matrix (row = from)
DUR = {ACT: (3, 7), BRK: (4, 11), DEP: (3, 5), ORO: (2, 5), WD: (2, 4), NOR: (2, 6)}
TRANS = np.array([
    # ACT   BRK   DEP   ORO   WD    NOR
    [0.00, 0.25, 0.20, 0.15, 0.10, 0.30],  # from ACTIVE
    [0.30, 0.00, 0.20, 0.10, 0.15, 0.25],  # from BREAK
    [0.45, 0.10, 0.00, 0.10, 0.05, 0.30],  # from DEPRESSION
    [0.35, 0.15, 0.15, 0.00, 0.05, 0.30],  # from OROGRAPHIC
    [0.20, 0.25, 0.15, 0.10, 0.00, 0.30],  # from WD
    [0.30, 0.20, 0.20, 0.15, 0.15, 0.00],  # from NORMAL
])
# Month preference (Jun, Jul, Aug, Sep) - WDs in the shoulder months, lows at the peak
MONTH_W = np.array([
    [0.9, 1.1, 1.1, 0.8],   # ACT
    [0.5, 1.0, 1.3, 0.9],   # BRK
    [0.8, 1.3, 1.3, 0.9],   # DEP
    [2.2, 1.8, 1.4, 1.0],   # ORO
    [1.6, 0.6, 0.6, 1.5],   # WD
    [1.0, 1.0, 1.0, 1.0],   # NOR
])

TERMS = ["BG", "MT", "BAY", "WG", "NE", "FOOT", "SPEN", "NWH", "ANI"]
AMP = dict(BG=1.6, MT=6.5, BAY=4.5, WG=24.0, NE=18.0, FOOT=7.5, SPEN=3.0, NWH=3.0, ANI=13.0)
# Observed-atmosphere multipliers by regime
MULT = {
    ACT: dict(BG=1.2, MT=2.0, BAY=1.5, WG=1.8, NE=0.8, FOOT=0.6, SPEN=0.8, NWH=0.5, ANI=1.2),
    BRK: dict(BG=0.6, MT=0.15, BAY=0.4, WG=0.35, NE=2.0, FOOT=2.4, SPEN=1.8, NWH=0.6, ANI=0.8),
    DEP: dict(BG=1.0, MT=1.3, BAY=1.2, WG=1.2, NE=0.9, FOOT=1.0, SPEN=0.8, NWH=0.8, ANI=1.3),
    ORO: dict(BG=0.9, MT=0.8, BAY=0.8, WG=2.2, NE=0.8, FOOT=0.8, SPEN=0.6, NWH=0.5, ANI=1.0),
    WD:  dict(BG=0.9, MT=0.9, BAY=0.9, WG=0.9, NE=1.0, FOOT=1.6, SPEN=1.0, NWH=1.5, ANI=1.0),
    NOR: dict(BG=1.0, MT=1.0, BAY=1.0, WG=1.0, NE=1.0, FOOT=1.0, SPEN=1.0, NWH=1.0, ANI=1.0),
}
# Systematic NWP error multipliers applied on top of MULT (regime-dependent bias)
NWP_BIAS = {
    ACT: dict(WG=0.70, MT=0.85, FOOT=1.3),
    BRK: dict(MT=5.0, BAY=1.8, FOOT=0.55, NE=0.65, SPEN=0.8, WG=1.6),
    DEP: dict(WG=0.9),
    ORO: dict(WG=0.45),
    WD:  dict(NWH=0.8, FOOT=0.8),
    NOR: dict(WG=0.8),
}
# Which regime an NWP run confuses the true one with (for lead-dependent regime errors)
CONFUSE = {ACT: [NOR, ORO], BRK: [NOR, WD], DEP: [ACT, NOR], ORO: [ACT, NOR], WD: [BRK, NOR], NOR: [ACT, BRK]}

# Dynamical indices seen by the regime classifier: (mean by regime, within-regime sd)
INDEX_NAMES = ["mt_lat_anom", "llj_u850", "vort850", "mslp_min_anom", "offshore_trough", "wd_z500_trough", "olr_cmz_anom"]
INDEX_MEAN = np.array([
    # mt_lat  llj   vort  mslp  offsh  wd    olr
    [-1.0,   16.0,  3.0, -3.0,  0.6,  0.0, -25.0],  # ACT
    [3.0,     8.0,  1.0,  1.0, -0.3,  0.4,  25.0],  # BRK
    [-0.3,   13.0,  9.0, -8.0,  0.3,  0.0, -12.0],  # DEP
    [0.0,    18.0,  2.5, -2.0,  2.2,  0.0,  -5.0],  # ORO
    [1.0,    10.0,  1.5,  0.0,  0.0,  2.5,   8.0],  # WD
    [0.0,    12.0,  2.0, -1.0,  0.2,  0.0,   0.0],  # NOR
])
INDEX_SD = np.array([1.1, 2.6, 2.0, 2.0, 0.7, 0.7, 13.0])
RHO = [0.85, 0.72, 0.60, 0.48, 0.38]  # small-scale predictability by lead


@dataclass
class DayState:
    regime: int
    doy: int
    amp: float
    dep: dict | None = None      # centre, sigma, amplitude
    oro: dict | None = None
    wd: dict | None = None
    cells: list = field(default_factory=list)  # embedded convective cells (lat, lon, amp, sigma)
    z_small: np.ndarray | None = None
    z_occ: np.ndarray | None = None
    idx: np.ndarray | None = None


class Twin:
    def __init__(self, geo: Geo):
        self.g = geo
        LAT, LON = geo.LAT, geo.LON
        self.LAT, self.LON = LAT, LON
        e = geo.elev
        ww = geo.windward
        arid = np.where(LAT > 22, 1 / (1 + np.exp(-(LON - 72.8) / 1.0)), 1.0)
        ladakh = np.where(e > 3500, 0.15, 1.0)
        shadow = np.where((LAT < 14.5) & (LON > 77.3) & (geo.d_as > 120), 0.45, 1.0)
        self.arid = arid
        latmod = np.clip(0.6 + 0.5 * np.exp(-((LAT - 15.5) / 4.5) ** 2), 0, None) * \
            (1 / (1 + np.exp(-(LAT - 7.8) / 0.4))) * (1 / (1 + np.exp((LAT - 21.8) / 0.4)))
        west = LON < 78.5
        P = {}
        P["BG"] = arid * ladakh * shadow
        P["WG"] = (0.55 * np.exp(-geo.d_as / 70) + 0.55 * np.clip(ww / 8, 0, 1.5) * np.exp(-geo.d_as / 180)) * latmod * west
        P["NE"] = (1.8 * np.exp(-(((LAT - 25.3) / 0.35) ** 2 + ((LON - 91.6) / 0.9) ** 2))
                   + 0.6 * np.exp(-(((LAT - 26.8) / 1.6) ** 2 + ((LON - 93.5) / 2.5) ** 2))
                   + 0.35 * np.clip(ww / 10, 0, 1.2) * (LON > 88.5) * (LAT > 22))
        band = (LAT > 26) & (LON > 74) & (LON < 89.5) & (e < 3800)
        P["FOOT"] = (np.clip(ww / 6, 0, 1.4) + 0.4 * np.exp(-((e - 800) / 700) ** 2)) * band
        P["NWH"] = np.exp(-((LAT - 32.3) / 1.6) ** 2) * np.exp(-((LON - 76.5) / 2.5) ** 2) * \
            (0.5 + 0.5 * np.clip(e / 1500, 0, 1)) * np.where(e > 4000, 0.3, 1.0)
        P["SPEN"] = (np.exp(-(((LAT - 12.5) / 2.5) ** 2 + ((LON - 79.5) / 2.0) ** 2))
                     + 0.5 * np.exp(-geo.d_bob / 90) * (LAT < 17))
        P["BAY"] = np.exp(-(((LAT - 21.5) / 2.6) ** 2 + ((LON - 85.0) / 3.2) ** 2)) + 0.3 * np.exp(-geo.d_bob / 120) * (LAT > 17)
        P["ANI"] = ((LON > 91.5) & (LAT < 14.5)).astype(float)
        self.P = P
        # Monsoon onset / withdrawal isochrones (days after 1 June)
        onset_as = 1.25 * (LAT - 8) + 1.2 * np.clip(78 - LON, 0, None) * (LAT > 21)
        onset_bb = 3 + 1.5 * np.clip(92 - LON, 0, None) + 0.4 * np.abs(LAT - 25)
        self.onset = np.clip(np.minimum(onset_as, onset_bb), 0, 40)
        self.withdraw = np.where(LAT > 20, 108 + (30 - LAT) * 2.0 + (LON - 70) * 0.6, 200)

    # ---------- large-scale patterns ----------
    def mt_band(self, shift):
        """Monsoon trough rain belt; axis Ganganagar (29.9N, 73.9E) -> Digha (21.7N, 87.5E),
        rain maximum ~1.8 deg south of the axis. shift > 0 moves the belt south."""
        LAT, LON = self.LAT, self.LON
        p1, p2 = np.array([21.7, 87.5]), np.array([29.9, 73.9])
        d = p2 - p1
        n = np.array([d[1], -d[0]]) / np.hypot(*d)
        s = (LAT - p1[0]) * n[0] + (LON - p1[1]) * n[1]  # degrees, +ve south of the axis
        box = (1 / (1 + np.exp(-(LON - 70.5) / 0.6))) * (1 / (1 + np.exp((LON - 89) / 0.6))) * (LAT > 15)
        return np.exp(-((s - 1.8 - shift) / 3.2) ** 2) * box * (0.35 + 0.65 * self.arid)

    def season(self, doy):
        s = 1 / (1 + np.exp(-(doy - self.onset) / 2.5))
        w = 1 / (1 + np.exp(-(doy - self.withdraw) / 3.0))
        return (0.12 + 0.88 * s) * (1 - 0.8 * w)

    @staticmethod
    def gauss(LAT, LON, la, lo, sla, slo=None):
        slo = sla if slo is None else slo
        return np.exp(-0.5 * (((LAT - la) / sla) ** 2 + ((LON - lo) / slo) ** 2))

    # ---------- regime sequence ----------
    def regime_sequence(self, rng):
        seq = []
        cur = rng.choice([NOR, ACT, ORO], p=[0.5, 0.2, 0.3])
        while len(seq) < C.SEASON_DAYS:
            lo, hi = DUR[cur]
            seq += [cur] * int(rng.integers(lo, hi + 1))
            month = min(len(seq) // 31, 3)
            p = TRANS[cur] * MONTH_W[:, month]
            cur = int(rng.choice(6, p=p / p.sum()))
        return np.array(seq[:C.SEASON_DAYS])

    # ---------- truth ----------
    def smooth_noise(self, rng, sigma):
        z = ndimage.gaussian_filter(rng.standard_normal(self.LAT.shape), sigma, mode="wrap")
        return z / z.std()

    def build_states(self, rng, regimes):
        states, ev = [], None
        for t, r in enumerate(regimes):
            new = t == 0 or regimes[t - 1] != r
            st = DayState(regime=int(r), doy=t, amp=float(np.exp(rng.normal(0, 0.18))))
            if r == DEP:
                if new:
                    th = np.deg2rad(rng.uniform(12, 28))
                    sp = rng.uniform(1.8, 2.8)
                    ev = dict(lat=rng.uniform(20.3, 22.3), lon=rng.uniform(87.3, 89.3), dlat=sp * np.sin(th),
                              dlon=-sp * np.cos(th), A=float(np.exp(rng.normal(np.log(95), 0.25))),
                              sig=rng.uniform(1.1, 1.5), age=0)
                else:
                    ev = dict(ev, lat=ev["lat"] + ev["dlat"], lon=ev["lon"] + ev["dlon"], age=ev["age"] + 1)
                life = 1.0 - 0.18 * max(0, ev["age"] - 2)  # weakens after landfall + 2 days
                st.dep = dict(lat=ev["lat"], lon=ev["lon"], A=ev["A"] * life, sig=ev["sig"])
            elif r == ORO:
                if new:
                    ev = dict(phi=rng.uniform(10.5, 19.5), A=float(np.exp(rng.normal(np.log(130), 0.2))), s=rng.uniform(2.0, 3.2))
                ev = dict(ev, phi=float(np.clip(ev["phi"] + rng.normal(0, 0.6), 9.0, 20.5)))
                st.oro = dict(ev)
            elif r == WD:
                if new:
                    ev = dict(lon=rng.uniform(73.5, 75.5), lat=rng.uniform(31.3, 32.8), A=float(np.exp(rng.normal(np.log(70), 0.25))))
                else:
                    ev = dict(ev, lon=ev["lon"] + rng.uniform(1.5, 2.5), lat=ev["lat"] - rng.uniform(0.2, 0.6))
                st.wd = dict(ev)
            # embedded convective cells (short-lived, re-drawn daily)
            ncell = {ACT: rng.integers(4, 8), BRK: rng.integers(2, 5), DEP: rng.integers(1, 4),
                     ORO: rng.integers(1, 3), WD: rng.integers(1, 3), NOR: rng.integers(1, 4)}[r]
            for _ in range(int(ncell)):
                if r == BRK:
                    la, lo = (rng.uniform(26.3, 28.5), rng.uniform(78, 89)) if rng.random() < 0.6 else (rng.uniform(24, 27.5), rng.uniform(89.5, 95))
                elif r == WD:
                    la, lo = rng.uniform(29.5, 33.5), rng.uniform(74, 80)
                else:
                    x = rng.uniform(0, 1)  # along the monsoon trough / west coast
                    if rng.random() < 0.65:
                        la, lo = 22.0 + 5.3 * x + rng.normal(-1.5, 1.4), 88.0 - 15.5 * x + rng.normal(0, 0.8)
                    else:  # windward Western Ghats, just inland of the coastline
                        la = rng.uniform(9, 20.5)
                        lo = 72.85 + (19.0 - la) * 0.33 + rng.uniform(0.0, 0.5)
                st.cells.append((la, lo, float(np.exp(rng.normal(np.log(55), 0.35))), rng.uniform(0.4, 0.8)))
            st.z_small = self.smooth_noise(rng, 1.6)
            st.z_occ = self.smooth_noise(rng, 2.2)
            st.idx = INDEX_MEAN[r] + rng.normal(0, 1, 7) * INDEX_SD
            if st.dep:  # intensity-aware dynamics
                st.idx[2] += (st.dep["A"] - 110) / 25
                st.idx[3] -= (st.dep["A"] - 110) / 20
            states.append(st)
        return states

    def mean_field(self, st: DayState, regime=None, nwp=False, lead=1, rng=None):
        """Expected rainfall (mm/day) for a day state; with nwp=True the regime-dependent
        systematic errors of the forecast model are applied."""
        r = st.regime if regime is None else regime
        LAT, LON = self.LAT, self.LON
        seas = self.season(st.doy)
        m = dict(MULT[r])
        if nwp:
            for k, v in NWP_BIAS[r].items():
                m[k] *= v
        mt_shift = {ACT: 1.0, BRK: -3.0, DEP: 0.3, ORO: 0.0, WD: -0.5, NOR: 0.0}[r]
        if nwp and r == ACT:
            mt_shift -= 0.8  # NWP keeps the trough too far north
        if nwp and r == BRK:
            mt_shift = -1.0  # NWP keeps the trough near normal -> false alarms over central India
        f = sum(AMP[k] * m[k] * (self.mt_band(mt_shift) if k == "MT" else self.P[k]) for k in TERMS if k != "NWH")
        f = f * seas + AMP["NWH"] * m["NWH"] * self.P["NWH"]
        f = f * st.amp
        g = self.gauss
        if st.dep and r == DEP:
            d = st.dep
            la, lo, A, sg = d["lat"], d["lon"], d["A"], d["sig"]
            sw = (-0.9, -0.9)
            if nwp:
                la += 0.22 * lead + rng.normal(0, 0.25 * lead)
                lo += -(0.35 + 0.45 * lead) + rng.normal(0, 0.3 * lead)
                A, sg, sw = A * 0.6, sg * 1.35, (0.0, 0.0)
                self.last_dep = (la, lo)
            f = f + A * g(LAT, LON, la + sw[0], lo + sw[1], sg) + 0.3 * A * g(LAT, LON, la, lo, 2.2 * sg)
        if st.oro and r == ORO:
            o = st.oro
            if nwp:
                f = f + 0.45 * o["A"] * np.exp(-((LAT - o["phi"]) / o["s"]) ** 2) * np.exp(-self.g.d_as / 150) * (LON < 79)
            else:
                f = f + o["A"] * np.exp(-((LAT - o["phi"]) / o["s"]) ** 2) * np.exp(-self.g.d_as / 45) * \
                    (0.6 + 0.6 * np.clip(self.g.windward / 8, 0, 1)) * (LON < 78.5)
        if st.wd and r == WD:
            w = st.wd
            if nwp:
                f = f + 0.65 * w["A"] * g(LAT, LON, w["lat"] - 0.9, w["lon"], 1.3, 1.9)
            else:
                e = self.g.elev
                f = f + w["A"] * g(LAT, LON, w["lat"], w["lon"], 1.1, 1.6) * (0.4 + 0.8 * np.clip(e / 1500, 0, 1)) * np.where(e > 4200, 0.35, 1)
        for (la, lo, A, sg) in st.cells:
            if nwp:
                if rng.random() < 0.15 + 0.07 * lead:
                    continue  # missed cell
                la, lo = la + rng.normal(0, 0.25 + 0.2 * lead), lo + rng.normal(0, 0.25 + 0.2 * lead)
                A, sg = A * rng.uniform(0.35, 0.75), sg * 1.3
            f = f + A * seas.clip(0.3, 1) * g(LAT, LON, la, lo, sg)
        if nwp:  # spurious convective cells
            for _ in range(int(rng.poisson(1 + 0.3 * lead))):
                la, lo = rng.uniform(17, 27), rng.uniform(74, 88)
                f = f + rng.uniform(25, 55) * g(LAT, LON, la, lo, 0.7)
        return np.clip(f, 0, None)

    def realise(self, mu, z, u, wet_div, sigma=0.75):
        p = np.clip(1 - np.exp(-mu / wet_div), 0.03, 0.97)
        amt = mu / p * np.exp(sigma * z - sigma ** 2 / 2)
        return np.where(u < p, amt, 0.0).clip(0, 480)

    def observe(self, st):
        return self.realise(self.mean_field(st), st.z_small, ndtr(st.z_occ), wet_div=3.0)

    def forecast(self, st, prev_regime, lead, rng):
        r = st.regime
        if prev_regime != r and rng.random() < 0.10 + 0.06 * lead:
            r_f = prev_regime  # model late on the regime transition
        elif rng.random() < 0.03 * lead:
            r_f = int(rng.choice(CONFUSE[r]))
        else:
            r_f = r
        self.last_dep = None
        mu = self.mean_field(st, regime=r_f, nwp=True, lead=lead, rng=rng)
        rho = RHO[lead - 1]
        z = rho * st.z_small + np.sqrt(1 - rho ** 2) * self.smooth_noise(rng, 1.6)
        zo = rho * st.z_occ + np.sqrt(1 - rho ** 2) * self.smooth_noise(rng, 2.2)
        f = self.realise(mu, z, ndtr(zo), wet_div=1.5, sigma=0.55)
        f = ndimage.gaussian_filter(f, 0.9)              # effective model resolution
        f = f * (1 + f / 120.0) ** -0.2                   # damped extremes
        f = np.where((f < 1.0) & (mu > 0.6), f + 0.8, f)  # drizzle bias
        idx = INDEX_MEAN[r_f] + (st.idx - INDEX_MEAN[st.regime]) + rng.normal(0, 1, 7) * INDEX_SD * (0.25 + 0.12 * lead)
        return f.astype(np.float32), idx.astype(np.float32), r_f, self.last_dep


def simulate_year(geo: Geo, year: int, twin: Twin | None = None):
    """Returns dict(obs[T,NY,NX], fc[L,T,NY,NX], regimes[T], regimes_fc[L,T], idx_fc[L,T,7], dep_true[T,2], dep_fc[L,T,2])."""
    twin = twin or Twin(geo)
    rng = np.random.default_rng(C.SEED + year)
    regimes = twin.regime_sequence(rng)
    states = twin.build_states(rng, regimes)
    T, NL = len(states), len(C.LEADS)
    obs = np.zeros((T,) + geo.india.shape, np.float32)
    fc = np.zeros((NL, T) + geo.india.shape, np.float32)
    idx_fc = np.zeros((NL, T, 7), np.float32)
    reg_fc = np.zeros((NL, T), int)
    dep_true = np.full((T, 2), np.nan)
    dep_fc = np.full((NL, T, 2), np.nan)
    for t, st in enumerate(states):
        obs[t] = twin.observe(st)
        if st.dep:
            dep_true[t] = st.dep["lat"], st.dep["lon"]
        prev = states[t - 1].regime if t else st.regime
        for li, L in enumerate(C.LEADS):
            frng = np.random.default_rng((C.SEED, year, t, L))
            f, idx, rf, dc = twin.forecast(st, prev, L, frng)
            fc[li, t], idx_fc[li, t], reg_fc[li, t] = f, idx, rf
            if dc is not None:
                dep_fc[li, t] = dc
    return dict(obs=obs, fc=fc, regimes=regimes, regimes_fc=reg_fc, idx_fc=idx_fc,
                dep_true=dep_true, dep_fc=dep_fc)
