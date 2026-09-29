"""End-to-end experiment: simulate -> classify regimes -> train correctors -> calibrate -> verify.

Split (no leakage):  TRAIN 2019-22 fit classifier + experts + baselines
                     CALIB 2023    fit frequency calibration (regime QM) + probability isotonic maps
                     TEST  2024-25 every number in the verification report
"""
import time
from datetime import date, timedelta

import numpy as np
from scipy import sparse
from sklearn.inspection import permutation_importance
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score

from . import config as C
from .features import CELL_FEATURES, REGIME_FEATURES, Featurizer
from .geo import build_geo
from .models import (ExceedanceModel, Experts, GlobalML, QuantileMap, RegimeAwareTrunk, RegimeClassifier, RegimeQM)
from .simulate import Twin, simulate_year
from .verify import FSS, Accumulator, probabilistic

METHODS = ["RAW", "QM", "ML", "QMR", "MOE", "VARSHA"]
METHOD_INFO = {
    "RAW": {"name": "Raw NWP", "desc": "Direct model output, no post-processing", "color": "#f43f5e"},
    "QM": {"name": "Quantile Mapping", "desc": "Classical single-distribution bias correction (per lead)", "color": "#f59e0b"},
    "ML": {"name": "Global ML", "desc": "One gradient-boosted corrector for all situations (no regime info)", "color": "#a3a3a3"},
    "QMR": {"name": "Regime QM", "desc": "Quantile mapping conditioned on the predicted regime", "color": "#60a5fa"},
    "MOE": {"name": "VARSHA-mean", "desc": "Regime-gated experts + regime-aware trunk, conditional mean (min-RMSE best estimate)", "color": "#a78bfa"},
    "VARSHA": {"name": "VARSHA", "desc": "VARSHA-mean + regime-wise frequency calibration, blend tuned on 2023 for heavy rain (operational)", "color": "#22d3ee"},
}
PROB_THR = [C.HEAVY, C.VHEAVY, C.XHEAVY]


def day_date(year, t):
    return date(year, 6, 1) + timedelta(days=int(t))


def rule_regime(X, mu, sd):
    """Forecaster-checklist baseline: fixed thresholds on the same indices."""
    f = {n: X[:, i] for i, n in enumerate(REGIME_FEATURES)}
    z_cmz = (f["r_cmz"] - mu[REGIME_FEATURES.index("r_cmz")]) / sd[REGIME_FEATURES.index("r_cmz")]
    out = np.full(len(X), 5)
    out[z_cmz < -0.8] = 1
    out[z_cmz > 0.8] = 0
    out[f["offshore_trough"] > 1.4] = 3
    out[f["wd_z500_trough"] > 1.5] = 4
    out[(f["mslp_min_anom"] < -5) & (f["vort850"] > 6)] = 2
    return out


def run(log=print):
    T0 = time.time()
    geo = build_geo()
    twin = Twin(geo)
    fz = Featurizer(geo)
    N = len(geo.idx)
    NL = len(C.LEADS)

    # ------------------------------------------------------------------ simulate
    log(f"[1/7] simulating {len(C.YEARS)} monsoon seasons on the {C.NLAT}x{C.NLON} grid ({N} India cells)")
    sims = {y: simulate_year(geo, y, twin) for y in C.YEARS}

    # ------------------------------------------------------------------ regime classifier
    log("[2/7] regime classifier")
    rows, ys, yrs, leads, days = [], [], [], [], []
    for y in C.YEARS:
        s = sims[y]
        for li, L in enumerate(C.LEADS):
            for t in range(C.SEASON_DAYS):
                rows.append(fz.regime(s["fc"][li, t], s["idx_fc"][li, t], L, t))
                ys.append(s["regimes"][t]); yrs.append(y); leads.append(L); days.append(t)
    XR, YR, GR, LR, DR = map(np.asarray, (rows, ys, yrs, leads, days))
    tr = np.isin(GR, C.TRAIN_YEARS)
    P_reg = np.zeros((len(XR), C.NREG), np.float32)
    for y in C.TRAIN_YEARS:  # leave-one-season-out -> honest probabilities for training downstream models
        m = tr & (GR != y)
        P_reg[GR == y] = RegimeClassifier().fit(XR[m], YR[m]).predict_proba(XR[GR == y])
    clf = RegimeClassifier().fit(XR[tr], YR[tr])
    P_reg[~tr] = clf.predict_proba(XR[~tr])
    te = np.isin(GR, C.TEST_YEARS)
    pred = P_reg.argmax(1)
    mu, sd = np.nanmean(XR[tr], 0), np.nanstd(XR[tr], 0) + 1e-6
    rule = rule_regime(XR, mu, sd)
    reg_report = {
        "accuracy": round(float(accuracy_score(YR[te], pred[te])), 4),
        "macro_f1": round(float(f1_score(YR[te], pred[te], average="macro")), 4),
        "rule_accuracy": round(float(accuracy_score(YR[te], rule[te])), 4),
        "rule_macro_f1": round(float(f1_score(YR[te], rule[te], average="macro")), 4),
        "by_lead": [{"lead": L,
                     "accuracy": round(float(accuracy_score(YR[te & (LR == L)], pred[te & (LR == L)])), 4),
                     "macro_f1": round(float(f1_score(YR[te & (LR == L)], pred[te & (LR == L)], average="macro")), 4),
                     "rule_accuracy": round(float(accuracy_score(YR[te & (LR == L)], rule[te & (LR == L)])), 4)}
                    for L in C.LEADS],
        "confusion": confusion_matrix(YR[te], pred[te], labels=range(C.NREG)).tolist(),
        "confusion_lead1": confusion_matrix(YR[te & (LR == 1)], pred[te & (LR == 1)], labels=range(C.NREG)).tolist(),
        "per_class_f1": [round(float(v), 4) for v in f1_score(YR[te], pred[te], average=None, labels=range(C.NREG))],
    }
    pi = permutation_importance(clf.m, XR[te], YR[te], n_repeats=5, random_state=C.SEED, scoring="accuracy")
    reg_report["importance"] = sorted([{"feature": f, "importance": round(float(v), 4)}
                                       for f, v in zip(REGIME_FEATURES, pi.importances_mean)],
                                      key=lambda d: -d["importance"])
    reg_report["feature_mean"] = mu.round(4).tolist()
    reg_report["feature_sd"] = sd.round(4).tolist()
    reg_report["class_means"] = [np.nanmean(XR[tr & (YR == k)], 0).round(4).tolist() for k in range(C.NREG)]
    log(f"      test accuracy {reg_report['accuracy']:.3f} (rule baseline {reg_report['rule_accuracy']:.3f}), "
        f"macro-F1 {reg_report['macro_f1']:.3f}")
    ridx = {(g, l, d): i for i, (g, l, d) in enumerate(zip(GR, LR, DR))}

    # ------------------------------------------------------------------ training rows
    log("[3/7] building cell-level training set (heavy-rain oversampling with inverse-probability weights)")
    rng = np.random.default_rng(C.SEED)
    Xs, ys_, ws, rs, Ps = [], [], [], [], []
    qm_raw, qm_obs, qm_reg, qm_lead = [], [], [], []
    for y in C.TRAIN_YEARS:
        s = sims[y]
        for t in range(C.SEASON_DAYS):
            o = s["obs"][t].ravel()[geo.idx]
            for li, L in enumerate(C.LEADS):
                X = fz.cells(s["fc"][li, t], L, t)
                heavy = (o >= 30) | (X[:, 0] >= 30)
                p = np.where(heavy, 1.0, 0.04)
                keep = rng.random(N) < p
                Xs.append(X[keep]); ys_.append(o[keep]); ws.append(1 / p[keep])
                rs.append(np.full(keep.sum(), s["regimes"][t])); Ps.append(np.repeat(P_reg[ridx[(y, L, t)]][None], keep.sum(), 0))
                u = rng.random(N) < 0.08
                qm_raw.append(X[u, 0]); qm_obs.append(o[u]); qm_reg.append(np.full(u.sum(), s["regimes"][t])); qm_lead.append(np.full(u.sum(), L))
    X = np.concatenate(Xs); y_ = np.concatenate(ys_); w = np.concatenate(ws); r = np.concatenate(rs); Pt = np.concatenate(Ps)
    qm_raw, qm_obs, qm_reg, qm_lead = map(np.concatenate, (qm_raw, qm_obs, qm_reg, qm_lead))
    log(f"      {len(X):,d} training rows x {X.shape[1]} features")

    # ------------------------------------------------------------------ fit
    log("[4/7] fitting correctors")
    t1 = time.time()
    experts = Experts().fit(X, y_, w, Pt, log=log)
    trunk = RegimeAwareTrunk().fit(X, Pt, y_, w)
    glob = GlobalML().fit(X, y_, w)
    qm_g = {L: QuantileMap().fit(qm_raw[qm_lead == L], qm_obs[qm_lead == L]) for L in C.LEADS}
    qm_r = {L: RegimeQM().fit(qm_raw[qm_lead == L], qm_obs[qm_lead == L], qm_reg[qm_lead == L]) for L in C.LEADS}
    XP = np.hstack([X, Pt])
    exc = {thr: ExceedanceModel(thr).fit(XP, y_, w) for thr in PROB_THR}
    log(f"      done in {time.time() - t1:.0f}s")
    del X, XP

    def predict_block(y, li, L):
        """All methods for one season x lead. Returns dict of (T, N) arrays."""
        s = sims[y]
        T = C.SEASON_DAYS
        Xb = np.concatenate([fz.cells(s["fc"][li, t], L, t) for t in range(T)])
        Pb = np.concatenate([np.repeat(P_reg[ridx[(y, L, t)]][None], N, 0) for t in range(T)])
        regb = Pb.argmax(1)
        raw = Xb[:, 0].astype(np.float64)
        out = {"RAW": raw, "QM": qm_g[L](raw), "ML": glob.predict(Xb), "QMR": qm_r[L](raw, regb),
               "MOE": 0.5 * experts.predict(Xb, Pb) + 0.5 * trunk.predict(Xb, Pb)}
        XPb = np.hstack([Xb, Pb])
        for thr in PROB_THR:
            out[f"p{thr}"] = exc[thr].raw_proba(XPb)
        out["_reg"] = regb
        return {k: v.reshape(T, N) for k, v in out.items()}

    # ------------------------------------------------------------------ calibrate
    log("[5/7] calibration season (frequency-matching per regime, isotonic probabilities)")
    cm, co, cr, craw = [], [], [], []
    cp = {thr: [] for thr in PROB_THR}
    for y in C.CALIB_YEARS:
        o = sims[y]["obs"].reshape(C.SEASON_DAYS, -1)[:, geo.idx]
        for li, L in enumerate(C.LEADS):
            b = predict_block(y, li, L)
            cm.append(b["MOE"].ravel()); co.append(o.ravel()); cr.append(b["_reg"].ravel()); craw.append(b["RAW"].ravel())
            for thr in PROB_THR:
                cp[thr].append(b[f"p{thr}"].ravel())
    cm, co, cr, craw = map(np.concatenate, (cm, co, cr, craw))
    freq_cal = RegimeQM().fit(cm, co, cr)
    # blend weight: most heavy-rain skill (ETS@64.5) whose RMSE stays below raw NWP on the calibration season
    fm = freq_cal(cm, cr)
    rmse_raw = float(np.sqrt(np.mean((craw - co) ** 2)))
    best = (0.0, -1.0)
    alpha_scan = []
    for a in np.linspace(0, 1, 11):
        bl = a * fm + (1 - a) * cm
        rm = float(np.sqrt(np.mean((bl - co) ** 2)))
        ac = Accumulator([C.HEAVY]); ac.add(co, bl)
        ets = ac.categorical()[str(C.HEAVY)]["ets"] or 0.0
        alpha_scan.append({"alpha": round(float(a), 2), "rmse": round(rm, 3), "ets64": ets})
        if rm <= 0.97 * rmse_raw and ets > best[1]:
            best = (float(a), ets)
    alpha = best[0]
    log(f"      frequency-calibration blend alpha={alpha:.1f} (calib RMSE raw {rmse_raw:.2f})")
    del fm
    for thr in PROB_THR:
        exc[thr].calibrate(np.concatenate(cp[thr]), co)
    del cm, co, cr, cp

    # ------------------------------------------------------------------ test + verification
    log("[6/7] verifying on independent seasons " + ", ".join(map(str, C.TEST_YEARS)))
    thr_all = C.VERIF_THRESHOLDS + [C.XHEAVY]
    acc = {m: {(L, k): Accumulator(thr_all) for L in C.LEADS for k in range(-1, C.NREG)} for m in METHODS}
    dacc = {m: {L: Accumulator([15.6, 35.0, 64.5]) for L in C.LEADS} for m in METHODS}
    fss_l = {m: {L: FSS(geo.india, C.VERIF_THRESHOLDS, C.FSS_SCALES) for L in C.LEADS} for m in METHODS}
    fss_r = {m: {k: FSS(geo.india, C.VERIF_THRESHOLDS, C.FSS_SCALES) for k in range(C.NREG)} for m in METHODS}
    fss_proto = FSS(geo.india, C.VERIF_THRESHOLDS, C.FSS_SCALES)
    # district aggregation (area mean)
    rows_, cols_, vals_ = [], [], []
    pos = {c: i for i, c in enumerate(geo.idx)}
    for d in geo.districts:
        cs = [pos[c] for c in d["cells"]]
        rows_ += [d["id"]] * len(cs); cols_ += cs; vals_ += [1 / len(cs)] * len(cs)
    A = sparse.csr_matrix((vals_, (rows_, cols_)), shape=(len(geo.districts), N))
    prob_store = {thr: {"varsha": [], "nwp": [], "y": [], "lead": [], "reg": []} for thr in PROB_THR}
    store = {}
    full = np.zeros(C.NLAT * C.NLON)

    def to2d(v):
        full[:] = 0
        full[geo.idx] = v
        return full.reshape(C.NLAT, C.NLON).copy()

    for y in C.TEST_YEARS:
        s = sims[y]
        obs = s["obs"].reshape(C.SEASON_DAYS, -1)[:, geo.idx]
        st = {"obs": obs.astype(np.float32), "P": np.zeros((NL, C.SEASON_DAYS, C.NREG), np.float32)}
        for k in ("RAW", "VARSHA", "MOE") + tuple(f"p{t}" for t in PROB_THR):
            st[k] = np.zeros((NL, C.SEASON_DAYS, N), np.float32)
        for li, L in enumerate(C.LEADS):
            b = predict_block(y, li, L)
            b["VARSHA"] = alpha * freq_cal(b["MOE"].ravel(), b["_reg"].ravel()).reshape(b["MOE"].shape) + (1 - alpha) * b["MOE"]
            for thr in PROB_THR:
                b[f"p{thr}"] = exc[thr].iso.predict(b[f"p{thr}"].ravel()).reshape(b["MOE"].shape)
            for t in range(C.SEASON_DAYS):
                st["P"][li, t] = P_reg[ridx[(y, L, t)]]
            for k in ("RAW", "VARSHA", "MOE") + tuple(f"p{t}" for t in PROB_THR):
                st[k][li] = b[k]
            o2 = [to2d(obs[t]) for t in range(C.SEASON_DAYS)]
            raw2 = [to2d(b["RAW"][t]) for t in range(C.SEASON_DAYS)]
            for m in METHODS:
                for t in range(C.SEASON_DAYS):
                    k = int(s["regimes"][t])
                    a = Accumulator(thr_all); a.add(obs[t], b[m][t])
                    acc[m][(L, -1)].merge(a); acc[m][(L, k)].merge(a)
                    dacc[m][L].add(A @ obs[t], A @ b[m][t])
                    parts = fss_proto.day(o2[t], to2d(b[m][t]) if m != "RAW" else raw2[t])
                    fss_l[m][L].add_parts(parts); fss_r[m][k].add_parts(parts)
            # probability verification + NWP neighbourhood-probability baseline
            from scipy import ndimage
            for thr in PROB_THR:
                nb = np.stack([ndimage.uniform_filter((r2 >= thr).astype(float), 5, mode="constant").ravel()[geo.idx] for r2 in raw2])
                ps = prob_store[thr]
                ps["varsha"].append(b[f"p{thr}"].ravel().astype(np.float32)); ps["nwp"].append(nb.ravel().astype(np.float32))
                ps["y"].append((obs >= thr).ravel()); ps["lead"].append(np.full(obs.size, L, np.int8))
                ps["reg"].append(np.repeat(s["regimes"], N).astype(np.int8))
            log(f"      {y} lead {L} done")
        store[y] = st

    # ------------------------------------------------------------------ report
    log("[7/7] assembling verification report")
    rep = {"methods": METHODS, "method_info": METHOD_INFO, "thresholds": [str(t) for t in thr_all],
           "fss_scales_cells": C.FSS_SCALES, "fss_scales_km": [round(n * C.KM_PER_CELL) for n in C.FSS_SCALES],
           "fss_thresholds": [str(t) for t in C.VERIF_THRESHOLDS], "test_years": C.TEST_YEARS}

    def pooled(m, leads, regs):
        a = Accumulator(thr_all)
        for L in leads:
            for k in regs:
                a.merge(acc[m][(L, k)])
        return {**a.continuous(), "cat": a.categorical()}

    rep["overall"] = {m: pooled(m, C.LEADS, [-1]) for m in METHODS}
    rep["by_lead"] = {m: [pooled(m, [L], [-1]) for L in C.LEADS] for m in METHODS}
    rep["by_regime"] = {m: [pooled(m, C.LEADS, [k]) for k in range(C.NREG)] for m in METHODS}
    rep["regime_days"] = [int(sum((sims[y]["regimes"] == k).sum() for y in C.TEST_YEARS)) for k in range(C.NREG)]
    rep["district"] = {m: [{**dacc[m][L].continuous(), "cat": dacc[m][L].categorical()} for L in C.LEADS] for m in METHODS}

    def fss_merge(dct, keys):
        f = FSS(geo.india, C.VERIF_THRESHOLDS, C.FSS_SCALES)
        for k in keys:
            f.merge(dct[k])
        return f.result()

    rep["fss"] = {m: fss_merge(fss_l[m], C.LEADS) for m in METHODS}
    rep["fss_by_lead"] = {m: [fss_l[m][L].result() for L in C.LEADS] for m in METHODS}
    rep["fss_by_regime"] = {m: [fss_r[m][k].result() for k in range(C.NREG)] for m in METHODS}
    rep["prob"] = {}
    for thr in PROB_THR:
        ps = {k: np.concatenate(v) for k, v in prob_store[thr].items()}
        clim = float((qm_obs >= thr).mean())
        rep["prob"][str(thr)] = {
            "varsha": probabilistic(ps["varsha"], ps["y"], clim=clim),
            "nwp": probabilistic(ps["nwp"], ps["y"], clim=clim),
            "by_lead": [{"lead": L, "varsha": {k: v for k, v in probabilistic(ps["varsha"][ps["lead"] == L], ps["y"][ps["lead"] == L], clim=clim).items() if k != "reliability"},
                         "nwp": {k: v for k, v in probabilistic(ps["nwp"][ps["lead"] == L], ps["y"][ps["lead"] == L], clim=clim).items() if k != "reliability"}}
                        for L in C.LEADS],
            "by_regime": [{"regime": k, "varsha": {kk: vv for kk, vv in probabilistic(ps["varsha"][ps["reg"] == k], ps["y"][ps["reg"] == k], clim=clim).items() if kk != "reliability"},
                           "nwp": {kk: vv for kk, vv in probabilistic(ps["nwp"][ps["reg"] == k], ps["y"][ps["reg"] == k], clim=clim).items() if kk != "reliability"}}
                          for k in range(C.NREG)],
        }
    del prob_store
    rep["regime_classifier"] = reg_report
    rep["training"] = {"rows": int(len(y_)), "cell_features": CELL_FEATURES, "regime_features": REGIME_FEATURES,
                       "train_years": C.TRAIN_YEARS, "calib_years": C.CALIB_YEARS, "test_years": C.TEST_YEARS,
                       "grid": f"{C.RES} deg ({C.NLAT}x{C.NLON}), {N} India cells", "districts": len(geo.districts),
                       "runtime_s": round(time.time() - T0), "alpha": alpha, "alpha_scan": alpha_scan}
    models = {"classifier": clf, "experts": experts, "trunk": trunk, "alpha": alpha, "global": glob, "qm_global": qm_g, "qm_regime": qm_r,
              "freq_cal": freq_cal, "exceedance": exc}
    log(f"      pipeline finished in {time.time() - T0:.0f}s")
    return dict(geo=geo, sims=sims, store=store, report=rep, models=models, P_reg=P_reg, ridx=ridx,
                XR=XR, A=A)
