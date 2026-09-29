"""Forecast verification: continuous (RMSE, MAE, bias, r), categorical (POD, FAR, CSI, ETS, FBI, HSS)
from 2x2 contingency tables, neighbourhood Fractions Skill Score (Roberts & Lean 2008) and
probabilistic scores (Brier, BSS, reliability, ROC-AUC). Everything is accumulated so scores can be
pooled over days, leads and regimes exactly."""
import numpy as np
from scipy import ndimage
from sklearn.metrics import roc_auc_score


class Accumulator:
    """Streaming sums for continuous + categorical scores."""

    def __init__(self, thresholds):
        self.thr = list(thresholds)
        self.n = 0
        self.se = self.ae = self.e = 0.0
        self.sx = self.sy = self.sxx = self.syy = self.sxy = 0.0
        self.tab = np.zeros((len(self.thr), 4))  # hits, false alarms, misses, correct negatives

    def add(self, o, f):
        o = o.astype(np.float64)
        f = f.astype(np.float64)
        d = f - o
        self.n += o.size
        self.se += (d * d).sum()
        self.ae += np.abs(d).sum()
        self.e += d.sum()
        self.sx += f.sum(); self.sy += o.sum()
        self.sxx += (f * f).sum(); self.syy += (o * o).sum(); self.sxy += (f * o).sum()
        for i, t in enumerate(self.thr):
            fo, oo = f >= t, o >= t
            a = np.count_nonzero(fo & oo)
            b = np.count_nonzero(fo & ~oo)
            c = np.count_nonzero(~fo & oo)
            self.tab[i] += (a, b, c, o.size - a - b - c)

    def merge(self, other):
        for k in ("n", "se", "ae", "e", "sx", "sy", "sxx", "syy", "sxy"):
            setattr(self, k, getattr(self, k) + getattr(other, k))
        self.tab += other.tab
        return self

    def continuous(self):
        n = max(self.n, 1)
        cov = self.sxy / n - (self.sx / n) * (self.sy / n)
        vf = self.sxx / n - (self.sx / n) ** 2
        vo = self.syy / n - (self.sy / n) ** 2
        return {"rmse": float(np.sqrt(self.se / n)), "mae": float(self.ae / n), "bias": float(self.e / n),
                "corr": float(cov / np.sqrt(max(vf * vo, 1e-12))), "n": int(self.n)}

    def categorical(self):
        return {str(t): contingency_scores(*self.tab[i]) for i, t in enumerate(self.thr)}


def contingency_scores(a, b, c, d):
    n = a + b + c + d
    ar = (a + b) * (a + c) / n if n else 0.0
    pod = a / (a + c) if a + c else np.nan
    far = b / (a + b) if a + b else np.nan
    csi = a / (a + b + c) if a + b + c else np.nan
    ets = (a - ar) / (a + b + c - ar) if (a + b + c - ar) else np.nan
    fbi = (a + b) / (a + c) if a + c else np.nan
    hss_den = (a + c) * (c + d) + (a + b) * (b + d)
    hss = 2 * (a * d - b * c) / hss_den if hss_den else np.nan
    clean = lambda x: None if x is None or not np.isfinite(x) else round(float(x), 4)
    return {"pod": clean(pod), "far": clean(far), "csi": clean(csi), "ets": clean(ets), "fbi": clean(fbi),
            "hss": clean(hss), "sr": clean(1 - far) if np.isfinite(far) else None,
            "hits": int(a), "false_alarms": int(b), "misses": int(c), "correct_neg": int(d)}


class FSS:
    """Fractions Skill Score accumulated over days: FSS = 1 - sum(Pf-Po)^2 / sum(Pf^2+Po^2)."""

    def __init__(self, mask, thresholds, scales):
        self.mask = mask.astype(np.float64)
        self.thr, self.scales = list(thresholds), list(scales)
        self.mden = {n: ndimage.uniform_filter(self.mask, n, mode="constant") for n in self.scales}
        self.num = np.zeros((len(self.thr), len(self.scales)))
        self.den = np.zeros_like(self.num)
        self.obs_frac = np.zeros(len(self.thr)); self.cnt = 0

    def day(self, o2d, f2d):
        """Per-day contributions (num, den, observed count, n) - add to as many accumulators as needed."""
        m = self.mask > 0
        num = np.zeros_like(self.num); den = np.zeros_like(self.den); of = np.zeros(len(self.thr))
        for i, t in enumerate(self.thr):
            bo = (o2d >= t) * self.mask
            bf = (f2d >= t) * self.mask
            of[i] = bo[m].sum()
            for j, n in enumerate(self.scales):
                if n == 1:
                    po, pf = bo[m], bf[m]
                else:
                    po = ndimage.uniform_filter(bo, n, mode="constant")[m] / self.mden[n][m]
                    pf = ndimage.uniform_filter(bf, n, mode="constant")[m] / self.mden[n][m]
                num[i, j] = ((pf - po) ** 2).sum()
                den[i, j] = (pf * pf + po * po).sum()
        return num, den, of, int(m.sum())

    def add_parts(self, parts):
        num, den, of, cnt = parts
        self.num += num; self.den += den; self.obs_frac += of; self.cnt += cnt

    def add(self, o2d, f2d):
        self.add_parts(self.day(o2d, f2d))

    def merge(self, other):
        self.num += other.num; self.den += other.den; self.obs_frac += other.obs_frac; self.cnt += other.cnt
        return self

    def result(self):
        out = {}
        for i, t in enumerate(self.thr):
            f0 = self.obs_frac[i] / max(self.cnt, 1)
            fss = [None if self.den[i, j] == 0 else round(float(1 - self.num[i, j] / self.den[i, j]), 4)
                   for j in range(len(self.scales))]
            out[str(t)] = {"fss": fss, "useful": round(float(0.5 + f0 / 2), 4), "base_rate": round(float(f0), 5)}
        return out


def probabilistic(p, y, bins=10, clim=None):
    """Brier score, BSS against climatology, reliability table and ROC-AUC."""
    p = np.asarray(p, np.float64); y = np.asarray(y, np.float64)
    bs = float(np.mean((p - y) ** 2))
    c = y.mean() if clim is None else clim
    bs_ref = float(np.mean((c - y) ** 2))
    edges = np.linspace(0, 1, bins + 1)
    k = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    rel = []
    for b in range(bins):
        s = k == b
        if s.sum() >= 30:
            rel.append({"p": round(float(p[s].mean()), 4), "obs": round(float(y[s].mean()), 4), "n": int(s.sum())})
    try:
        auc = float(roc_auc_score(y, p)) if 0 < y.sum() < len(y) else None
    except ValueError:
        auc = None
    return {"brier": round(bs, 6), "bss": round(1 - bs / bs_ref, 4) if bs_ref > 0 else None,
            "auc": None if auc is None else round(auc, 4), "base_rate": round(float(y.mean()), 5), "reliability": rel}
