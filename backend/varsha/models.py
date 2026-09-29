"""Regime classifier, regime-gated mixture of correction experts, quantile mapping and
heavy-rainfall probability models."""
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.isotonic import IsotonicRegression

from . import config as C
from .features import CELL_FEATURES

X9 = CELL_FEATURES.index("x9")


def plausible(pred, X):
    """Physical-plausibility guard for log-link models: a corrected value may not exceed
    3x the NWP 9x9 neighbourhood maximum (min 80 mm), hard cap 500 mm/day."""
    return np.clip(pred, 0, np.minimum(500.0, np.maximum(80.0, 3.0 * X[:, X9])))


class RegimeClassifier:
    """Gradient-boosted classifier: large-scale NWP indices + regional rain stats -> P(regime)."""

    def __init__(self):
        self.m = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, max_leaf_nodes=15,
                                                min_samples_leaf=10, l2_regularization=1.0,
                                                class_weight="balanced", random_state=C.SEED)

    def fit(self, X, y):
        self.m.fit(X, y)
        return self

    def predict_proba(self, X):
        P = np.zeros((len(X), C.NREG), np.float32)
        P[:, self.m.classes_] = self.m.predict_proba(X)
        return P


class QuantileMap:
    """Empirical quantile mapping with a dense upper tail and ratio extrapolation."""
    LEVELS = np.unique(np.concatenate([np.linspace(0, 0.95, 191), 1 - np.logspace(np.log10(0.05), -4.3, 80)]))

    def fit(self, src, obs):
        s = np.quantile(src, self.LEVELS)
        o = np.quantile(obs, self.LEVELS)
        s = np.maximum.accumulate(s)
        keep = np.r_[np.diff(s) > 1e-6, True]  # collapse ties (e.g. many zeros): keep the last level
        self.s, self.o = s[keep], np.maximum.accumulate(o[keep])
        self.tail = self.o[-1] / max(self.s[-1], 1e-3)
        return self

    def __call__(self, x):
        y = np.interp(x, self.s, self.o)
        hi = x > self.s[-1]
        y[hi] = x[hi] * self.tail
        return y


class RegimeQM:
    """One quantile map per regime (+ a global fallback)."""

    def fit(self, src, obs, reg):
        self.glob = QuantileMap().fit(src, obs)
        self.maps = {}
        for k in range(C.NREG):
            sel = reg == k
            if sel.sum() > 20000:
                self.maps[k] = QuantileMap().fit(src[sel], obs[sel])
        return self

    def __call__(self, x, reg):
        y = self.glob(x)
        for k, qm in self.maps.items():
            sel = reg == k
            if sel.any():
                y[sel] = qm(x[sel])
        return y


def _hgb_reg():
    return HistGradientBoostingRegressor(loss="poisson", max_iter=250, learning_rate=0.08, max_leaf_nodes=63,
                                         min_samples_leaf=40, l2_regularization=1.0, early_stopping=False,
                                         random_state=C.SEED)


class Experts:
    """Mixture of regime experts: one gradient-boosted corrector per regime, blended by the
    classifier's regime probabilities (soft gating). Each expert is trained on every row, weighted by
    the out-of-fold gate probability of its regime (+ a small floor) - the same soft assignment it
    will see at inference, so misrouted days are learned rather than ignored."""

    def fit(self, X, y, w, P, floor=0.03, log=print):
        self.experts = {}
        for k in range(C.NREG):
            wk = w * (P[:, k] + floor)
            sel = P[:, k] + floor > 0.05
            log(f"    expert {C.REGIMES[k]['key']:<11s} effective rows={int(sel.sum()):>9,d}  weight share={wk.sum() / w.sum():.2f}")
            self.experts[k] = _hgb_reg().fit(X[sel], y[sel], sample_weight=wk[sel])
        return self

    def predict(self, X, P, min_w=0.02):
        """X (n,F), P (n, NREG) gating weights."""
        P = np.where(P >= min_w, P, 0)
        P = P / P.sum(1, keepdims=True)
        out = np.zeros(len(X))
        for k, m in self.experts.items():
            sel = P[:, k] > 0
            if sel.any():
                out[sel] += P[sel, k] * plausible(m.predict(X[sel]), X[sel])
        return out


class GlobalML:
    """One-size-fits-all ML corrector (same features, no regime information) - baseline."""

    def fit(self, X, y, w):
        self.m = _hgb_reg().fit(X, y, sample_weight=w)
        return self

    def predict(self, X):
        return plausible(self.m.predict(X), X)


class RegimeAwareTrunk:
    """Shared corrector that sees the regime probabilities as inputs (learns across regimes)."""

    def fit(self, X, P, y, w):
        self.m = _hgb_reg().fit(np.hstack([X, P]), y, sample_weight=w)
        return self

    def predict(self, X, P):
        return plausible(self.m.predict(np.hstack([X, P])), X)


class ExceedanceModel:
    """P(rain >= threshold): gradient-boosted classifier on cell features + regime probabilities,
    isotonic-calibrated on an independent season."""

    def __init__(self, thr):
        self.thr = thr
        self.m = HistGradientBoostingClassifier(max_iter=250, learning_rate=0.08, max_leaf_nodes=48,
                                                min_samples_leaf=60, l2_regularization=1.0,
                                                early_stopping=False, random_state=C.SEED)
        self.iso = None

    def fit(self, X, y_obs, w):
        self.m.fit(X, (y_obs >= self.thr).astype(int), sample_weight=w)
        return self

    def raw_proba(self, X):
        return self.m.predict_proba(X)[:, 1]

    def calibrate(self, p, y_obs):
        self.iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(p, (y_obs >= self.thr).astype(float))
        return self

    def predict(self, X):
        p = self.raw_proba(X)
        return self.iso.predict(p) if self.iso is not None else p
