"""Feature engineering.

Cell features  - per grid cell, from the raw NWP field: local value, neighbourhood statistics
                 (placement uncertainty), directional offsets (systematic displacement, e.g. a
                 depression moving too fast), terrain and coast (orographic / coastal errors).
Regime features - per forecast day: large-scale dynamical indices + regional rain statistics of
                 the NWP field (what a forecaster looks at to name the synoptic situation).
"""
import numpy as np
from scipy import ndimage

from .geo import Geo
from .simulate import INDEX_NAMES

CELL_FEATURES = [
    "f0", "m3", "m5", "m9", "m17", "x5", "x9", "sd5", "wet5", "hv9",
    "n1", "s1", "e1", "w1", "n2", "s2", "e2", "w2",
    "lat", "lon", "elev", "slope", "windward", "d_as", "d_bob", "lead", "doy",
]
REGION_NAMES = ["cmz", "wc", "ne", "foot", "nwh", "spen", "bay", "central", "india", "as_off", "bob_off"]
REGIME_FEATURES = INDEX_NAMES + [f"r_{r}" for r in REGION_NAMES] + [
    "h_cmz", "h35_frac", "x_india", "c_lat", "c_lon", "f_sd", "lead", "doy"]

# Friendly labels for the UI / explanations
FEATURE_LABELS = {
    "mt_lat_anom": "Monsoon-trough latitude anomaly", "llj_u850": "Low-level jet (U850)",
    "vort850": "850 hPa vorticity max", "mslp_min_anom": "Min MSLP anomaly",
    "offshore_trough": "West-coast offshore trough", "wd_z500_trough": "WD 500 hPa trough",
    "olr_cmz_anom": "OLR anomaly (core zone)", "r_cmz": "Core monsoon zone rain",
    "r_wc": "West-coast rain", "r_ne": "NE India rain", "r_foot": "Himalayan foothill rain",
    "r_nwh": "NW Himalaya rain", "r_spen": "SE peninsula rain", "r_bay": "Bay coast rain",
    "r_central": "Central India rain", "r_india": "All-India rain", "r_as_off": "Arabian Sea offshore rain",
    "r_bob_off": "Bay of Bengal offshore rain", "h_cmz": "Heavy-rain area (core zone)",
    "h35_frac": "Area > 35 mm", "x_india": "Max rain", "c_lat": "Heavy-rain centroid lat",
    "c_lon": "Heavy-rain centroid lon", "f_sd": "Spatial variability", "lead": "Lead time", "doy": "Day of season",
}


def shifted(a, dy, dx):
    """a evaluated at (i+dy, j+dx) with edge padding; rows increase northwards."""
    p = max(abs(dy), abs(dx))
    ap = np.pad(a, p, mode="edge")
    return ap[p + dy:p + dy + a.shape[0], p + dx:p + dx + a.shape[1]]


class Featurizer:
    def __init__(self, geo: Geo):
        self.g = geo
        self.idx = geo.idx
        LAT, LON = geo.LAT, geo.LON
        self.static = np.stack([LAT.ravel()[self.idx], LON.ravel()[self.idx]] +
                               [a.ravel()[self.idx] for a in (geo.elev, geo.slope, geo.windward, geo.d_as, geo.d_bob)],
                               1).astype(np.float32)
        ind, e = geo.india, geo.elev
        ocean = ~geo.land
        self.regions = {
            "cmz": ind & (LAT >= 18) & (LAT <= 28) & (LON >= 65) & (LON <= 88),
            "wc": ind & (LON < 77.5) & (LAT >= 8) & (LAT <= 21) & (geo.d_as < 120),
            "ne": ind & (LAT > 22) & (LON > 89),
            "foot": ind & (LAT > 26) & (LON > 74) & (LON < 89.5) & (e > 150) & (e < 3500),
            "nwh": ind & (LAT > 30) & (LON < 80.5),
            "spen": ind & (LAT < 15.5) & (LON > 77.3),
            "bay": ind & (geo.d_bob < 250) & (LAT > 17) & (LAT < 23.5),
            "central": ind & (LAT > 19) & (LAT < 25) & (LON > 74) & (LON < 84),
            "india": ind,
            "as_off": ocean & (LAT > 10) & (LAT < 20) & (LON > 68) & (LON < 73.5),
            "bob_off": ocean & (LAT > 15) & (LAT < 22) & (LON > 85) & (LON < 92),
        }
        self.LAT, self.LON = LAT, LON

    def cells(self, f, lead, doy):
        """(N_india, len(CELL_FEATURES)) feature matrix for one NWP field."""
        uf, mf = ndimage.uniform_filter, ndimage.maximum_filter
        m3, m5, m9, m17 = (uf(f, s, mode="nearest") for s in (3, 5, 9, 17))
        sd5 = np.sqrt(np.clip(uf(f * f, 5, mode="nearest") - m5 ** 2, 0, None))
        wet5 = uf((f >= 15.6).astype(np.float32), 5, mode="nearest")
        hv9 = uf((f >= 50).astype(np.float32), 9, mode="nearest")
        dyn = [f, m3, m5, m9, m17, mf(f, 5), mf(f, 9), sd5, wet5, hv9,
               shifted(m5, 4, 0), shifted(m5, -4, 0), shifted(m5, 0, 4), shifted(m5, 0, -4),
               shifted(m9, 8, 0), shifted(m9, -8, 0), shifted(m9, 0, 8), shifted(m9, 0, -8)]
        X = np.empty((len(self.idx), len(CELL_FEATURES)), np.float32)
        for k, a in enumerate(dyn):
            X[:, k] = a.ravel()[self.idx]
        X[:, len(dyn):len(dyn) + 7] = self.static
        X[:, -2] = lead
        X[:, -1] = doy
        return X

    def regime(self, f, idx_vals, lead, doy):
        """One row of REGIME_FEATURES for a forecast day."""
        r = [float(f[m].mean()) for m in self.regions.values()]
        cmz = f[self.regions["cmz"]]
        fi = f[self.g.india]
        h = fi >= 35
        if h.sum() >= 3:
            w = fi[h]
            c_lat = float((self.LAT[self.g.india][h] * w).sum() / w.sum())
            c_lon = float((self.LON[self.g.india][h] * w).sum() / w.sum())
        else:
            c_lat = c_lon = np.nan
        return np.array(list(idx_vals) + r + [
            float((cmz >= 64.5).mean()), float(h.mean()), float(fi.max()), c_lat, c_lon, float(fi.std()), lead, doy
        ], np.float32)
