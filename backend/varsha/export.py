"""Write the static data contract consumed by the dashboard (frontend/public/data).

meta.json                 grid, regimes, IMD categories, districts, methods, dates, curated events
timeline.json             one entry per valid date: regime truth, P(regime) per lead, domain stats
days/<date>.json          district table for the date: obs, raw & corrected (mean/max), P(heavy..), warnings
grid/<date>.bin           uint8 grids: obs + per lead [raw, corrected, P(heavy), P(very heavy)]
series/<district>.json    season time series for one district (obs vs raw vs corrected)
composites.json           regime atlas: mean obs / raw / corrected per regime (bias maps)
verification.json         full skill report (RMSE, ETS, CSI, POD, FAR, FSS, Brier, reliability ...)
districts.geojson, states.geojson
"""
import json
import shutil
from datetime import date, timedelta

import numpy as np

from . import config as C
from .features import FEATURE_LABELS, REGIME_FEATURES
from .geo import build_geo

LEVELS = ["green", "yellow", "orange", "red"]


def clean(o):
    """JSON-safe: NaN / inf -> null (browsers reject NaN in JSON)."""
    if isinstance(o, float):
        return o if np.isfinite(o) else None
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, np.generic):
        return clean(o.item())
    return o


def dump(path, obj):
    path.write_text(json.dumps(clean(obj), separators=(",", ":")))


def q_rain(r):
    return np.clip(np.round(40 * np.log1p(np.clip(r, 0, None))), 0, 255).astype(np.uint8)


def q_prob(p):
    return np.clip(np.round(p * 250), 0, 250).astype(np.uint8)


def warn_level(ph, pvh, pxh):
    lvl = np.zeros(ph.shape, np.int8)
    lvl[ph >= 0.3] = 1
    lvl[(ph >= 0.6) | (pvh >= 0.3)] = 2
    lvl[(pvh >= 0.6) | (pxh >= 0.35)] = 3
    return lvl


def obs_level(x):
    return np.select([x >= C.XHEAVY, x >= C.VHEAVY, x >= C.HEAVY], [3, 2, 1], 0).astype(np.int8)


def r1(a):
    return [round(float(v), 1) for v in a]


def pint(a):
    return [int(round(float(v) * 100)) for v in a]


class DistrictAgg:
    def __init__(self, geo):
        pos = {c: i for i, c in enumerate(geo.idx)}
        self.lists = [np.array([pos[c] for c in d["cells"]]) for d in geo.districts]
        self.order = np.concatenate(self.lists)
        self.offs = np.r_[0, np.cumsum([len(x) for x in self.lists])[:-1]]
        self.cnt = np.array([len(x) for x in self.lists])

    def mean(self, v):
        return np.add.reduceat(v[..., self.order], self.offs, axis=-1) / self.cnt

    def max(self, v):
        return np.maximum.reduceat(v[..., self.order], self.offs, axis=-1)


def export_all(run):
    geo = build_geo()
    out = C.EXPORT_DIR
    if out.exists():
        shutil.rmtree(out)
    for sub in ("days", "grid", "series"):
        (out / sub).mkdir(parents=True, exist_ok=True)
    store, sims, rep = run["store"], run["sims"], run["report"]
    XR, ridx = run["XR"], run["ridx"]
    rc = rep["regime_classifier"]
    mu = np.array([np.nan if v is None else v for v in rc["feature_mean"]], float)
    sd = np.array([np.nan if v is None else v for v in rc["feature_sd"]], float)
    imp = {d["feature"]: d["importance"] for d in rc["importance"]}
    top_feats = [d["feature"] for d in rc["importance"][:14] if d["feature"] not in ("lead", "doy")]
    agg = DistrictAgg(geo)
    D = len(geo.districts)
    NL = len(C.LEADS)
    dname = [f"{d['name']}, {d['state']}" for d in geo.districts]

    timeline, dates = [], []
    series = {k: [] for k in ("obs", "raw1", "cor1", "ph1", "raw3", "cor3", "obsx", "corx1")}
    events_pool = []
    comp = {k: {f: np.zeros(len(geo.idx)) for f in ("obs", "raw", "cor")} for k in range(C.NREG)}
    comp_n = np.zeros(C.NREG, int)

    for y in C.TEST_YEARS:
        st, sm = store[y], sims[y]
        for t in range(C.SEASON_DAYS):
            ds = (date(y, 6, 1) + timedelta(days=t)).isoformat()
            dates.append(ds)
            reg = int(sm["regimes"][t])
            obs = st["obs"][t]
            o_mean, o_max = agg.mean(obs), agg.max(obs)
            raw, cor = st["RAW"][:, t], st["VARSHA"][:, t]
            ph, pvh, pxh = st[f"p{C.HEAVY}"][:, t], st[f"p{C.VHEAVY}"][:, t], st[f"p{C.XHEAVY}"][:, t]
            raw_m, raw_x = agg.mean(raw), agg.max(raw)
            cor_m, cor_x = agg.mean(cor), agg.max(cor)
            dph, dpvh, dpxh = agg.max(ph), agg.max(pvh), agg.max(pxh)
            warn = warn_level(dph, dpvh, dpxh)
            olvl = obs_level(o_max)
            comp[reg]["obs"] += obs; comp[reg]["raw"] += raw[0]; comp[reg]["cor"] += cor[0]; comp_n[reg] += 1

            stats, signals = [], []
            for li, L in enumerate(C.LEADS):
                heavy_obs = olvl >= 1
                stats.append({
                    "lead": L, "obs_mean": round(float(obs.mean()), 2), "raw_mean": round(float(raw[li].mean()), 2),
                    "cor_mean": round(float(cor[li].mean()), 2), "max_obs": round(float(obs.max()), 1),
                    "max_raw": round(float(raw[li].max()), 1), "max_cor": round(float(cor[li].max()), 1),
                    "n_warn": [int((warn[li] == k).sum()) for k in range(4)],
                    "n_obs_heavy": int(heavy_obs.sum()),
                    "hits_varsha": int((heavy_obs & (warn[li] >= 1)).sum()),
                    "hits_raw": int((heavy_obs & (raw_x[li] >= C.HEAVY)).sum()),
                    "fa_varsha": int((~heavy_obs & (warn[li] >= 1)).sum()),
                    "fa_raw": int((~heavy_obs & (raw_x[li] >= C.HEAVY)).sum()),
                })
                x = XR[ridx[(y, L, t)]]
                z = (x - mu) / sd
                ok = [f for f in top_feats if np.isfinite(z[REGIME_FEATURES.index(f)])]
                sig = sorted(ok, key=lambda f: -abs(z[REGIME_FEATURES.index(f)]) * (0.3 + max(imp.get(f, 0), 0) ** 0.5))[:6]
                signals.append([{"f": f, "label": FEATURE_LABELS.get(f, f), "v": round(float(x[REGIME_FEATURES.index(f)]), 2),
                                 "z": round(float(z[REGIME_FEATURES.index(f)]), 2)} for f in sig])

            dep = None
            if np.isfinite(sm["dep_true"][t, 0]):
                t0 = t
                while t0 > 0 and np.isfinite(sm["dep_true"][t0 - 1, 0]):
                    t0 -= 1
                t1 = t
                while t1 < C.SEASON_DAYS - 1 and np.isfinite(sm["dep_true"][t1 + 1, 0]):
                    t1 += 1
                dep = {"obs": [round(float(v), 2) for v in sm["dep_true"][t]],
                       "fc": [None if not np.isfinite(sm["dep_fc"][li, t, 0]) else [round(float(v), 2) for v in sm["dep_fc"][li, t]] for li in range(NL)],
                       "track": [[round(float(v), 2) for v in sm["dep_true"][k]] for k in range(t0, t1 + 1)],
                       "day": t - t0 + 1}
            day = {
                "date": ds, "regime": reg, "pred": [[round(float(p), 3) for p in st["P"][li, t]] for li in range(NL)],
                "signals": signals, "dep": dep, "stats": stats,
                "d": {"obs": r1(o_mean), "obsx": r1(o_max),
                      "raw": [r1(raw_m[li]) for li in range(NL)], "rawx": [r1(raw_x[li]) for li in range(NL)],
                      "cor": [r1(cor_m[li]) for li in range(NL)], "corx": [r1(cor_x[li]) for li in range(NL)],
                      "ph": [pint(dph[li]) for li in range(NL)], "pvh": [pint(dpvh[li]) for li in range(NL)],
                      "pxh": [pint(dpxh[li]) for li in range(NL)], "warn": [warn[li].tolist() for li in range(NL)]},
            }
            dump(out / "days" / f"{ds}.json", day)
            buf = [q_rain(obs)]
            for li in range(NL):
                buf += [q_rain(raw[li]), q_rain(cor[li]), q_prob(ph[li]), q_prob(pvh[li])]
            (out / "grid" / f"{ds}.bin").write_bytes(np.concatenate(buf).tobytes())

            timeline.append({"date": ds, "regime": reg, "pred": day["pred"],
                             "obs_mean": stats[0]["obs_mean"], "raw_mean": [s["raw_mean"] for s in stats],
                             "cor_mean": [s["cor_mean"] for s in stats], "warn": [s["n_warn"] for s in stats],
                             "n_obs_heavy": stats[0]["n_obs_heavy"], "hits_varsha": [s["hits_varsha"] for s in stats],
                             "hits_raw": [s["hits_raw"] for s in stats], "max_obs": stats[0]["max_obs"],
                             "dep": dep["obs"] if dep else None})
            series["obs"].append(o_mean); series["obsx"].append(o_max)
            series["raw1"].append(raw_m[0]); series["cor1"].append(cor_m[0]); series["corx1"].append(cor_x[0])
            series["ph1"].append(dph[0]); series["raw3"].append(raw_m[2]); series["cor3"].append(cor_m[2])
            events_pool.append((ds, reg, int(heavy_obs.sum()), stats[0]["hits_varsha"] - stats[0]["hits_raw"],
                                float(obs.max()), dep))

    # per-district season series
    S = {k: np.stack(v) for k, v in series.items()}  # (days, D)
    for i in range(D):
        doc = {"id": i, "name": geo.districts[i]["name"], "state": geo.districts[i]["state"],
               **{k: (pint(S[k][:, i]) if k == "ph1" else r1(S[k][:, i])) for k in S}}
        dump(out / "series" / f"{i}.json", doc)

    # curated events (one headline case per regime + biggest VARSHA win)
    events, used = [], set()
    region_of = lambda la, lo: min(geo.districts, key=lambda d: (d["lat"] - la) ** 2 + (d["lon"] - lo) ** 2)["state"]
    titles = {0: "Active monsoon spell", 1: "Break monsoon", 2: "Monsoon depression", 3: "Offshore trough – Western Ghats deluge",
              4: "Western disturbance interaction", 5: "Normal monsoon day"}
    for k in (2, 3, 0, 4, 1):
        cand = sorted([e for e in events_pool if e[1] == k and e[0] not in used], key=lambda e: -(e[2] + 0.02 * e[4]))
        if cand:
            e = cand[0]; used.add(e[0])
            where = f" over {region_of(*e[5]['obs'])}" if e[5] else ""
            events.append({"date": e[0], "regime": k, "title": titles[k] + where,
                           "desc": f"{e[2]} districts observed heavy rain; peak {e[4]:.0f} mm/day"})
    best = sorted([e for e in events_pool if e[0] not in used], key=lambda e: -e[3])[0]
    events.append({"date": best[0], "regime": best[1], "title": "Biggest VARSHA gain",
                   "desc": f"{best[3]} more heavy-rain districts caught than raw NWP (Day-1)"})

    comp_out = {"n": comp_n.tolist(), "regimes": []}
    for k in range(C.NREG):
        n = max(comp_n[k], 1)
        comp_out["regimes"].append({f: [int(round(v * 10)) for v in comp[k][f] / n] for f in ("obs", "raw", "cor")})
    dump(out / "composites.json", comp_out)
    dump(out / "timeline.json", {"days": timeline})
    dump(out / "verification.json", rep)
    meta = {
        "app": {"name": "VARSHA", "tagline": "Regime-aware AI post-processing of NWP rainfall", "version": "0.1.0",
                "mode": "digital-twin", "generated": date.today().isoformat()},
        "grid": {"lat0": C.LAT0, "lon0": C.LON0, "res": C.RES, "nlat": C.NLAT, "nlon": C.NLON,
                 "cells": geo.idx.tolist(), "encoding": {"rain": "mm = exp(q/40)-1", "prob": "p = q/250",
                                                          "layout": "obs, then per lead: raw, cor, p_heavy, p_vheavy"}},
        "regimes": C.REGIMES, "categories": C.IMD_CATEGORIES, "leads": C.LEADS,
        "thresholds": {"heavy": C.HEAVY, "vheavy": C.VHEAVY, "xheavy": C.XHEAVY},
        "warning_levels": LEVELS,
        "districts": [{k: d[k] for k in ("id", "name", "state", "lat", "lon")} | {"ncell": len(d["cells"])} for d in geo.districts],
        "methods": rep["method_info"], "dates": dates, "events": events,
        "feature_labels": FEATURE_LABELS,
    }
    dump(out / "meta.json", meta)
    for f in ("districts.geojson", "states.geojson"):
        shutil.copy(C.DATA_DIR / f, out / f)
