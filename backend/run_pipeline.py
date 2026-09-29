"""Train + verify + export everything the dashboard needs.

    .venv/bin/python run_pipeline.py            # full run (~5-8 min on a laptop)
    .venv/bin/python run_pipeline.py --export   # re-export from the cached run only
"""
import json
import pickle
import sys
import time

import joblib
import numpy as np

from varsha import config as C


def main():
    C.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    C.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    run_cache = C.CACHE_DIR / "run.pkl"
    if "--export" not in sys.argv or not run_cache.exists():
        from varsha.pipeline import run
        res = run()
        joblib.dump(res["models"], C.MODEL_DIR / "varsha_models.joblib", compress=3)
        (C.MODEL_DIR / "report.json").write_text(json.dumps(res["report"], indent=1, default=float))
        keep = {k: res[k] for k in ("store", "report", "P_reg", "ridx", "XR")}
        keep["sims"] = {y: {k: v for k, v in res["sims"][y].items() if k != "fc"} for y in C.TEST_YEARS}
        with open(run_cache, "wb") as f:
            pickle.dump(keep, f, protocol=5)
        rep = res["report"]
    else:
        with open(run_cache, "rb") as f:
            keep = pickle.load(f)
        rep = keep["report"]

    o = rep["overall"]
    print("\n==================  TEST-SEASON VERIFICATION (2024-25, all leads)  ==================")
    print(f"{'method':<14}{'RMSE':>7}{'bias':>7}{'corr':>7} | {'ETS@2.5':>8}{'ETS@15.6':>9}{'ETS@64.5':>9}{'POD@64.5':>9}{'FAR@64.5':>9}{'CSI@64.5':>9}{'ETS@115.6':>10}")
    for m in rep["methods"]:
        c = o[m]["cat"]
        print(f"{rep['method_info'][m]['name']:<14}{o[m]['rmse']:7.2f}{o[m]['bias']:7.2f}{o[m]['corr']:7.3f} | "
              f"{c['2.5']['ets']:8.3f}{c['15.6']['ets']:9.3f}{c['64.5']['ets']:9.3f}{c['64.5']['pod']:9.3f}"
              f"{c['64.5']['far']:9.3f}{c['64.5']['csi']:9.3f}{c['115.6']['ets']:10.3f}")
    print("FSS@64.5 (scales", rep["fss_scales_km"], "km)")
    for m in rep["methods"]:
        print(f"  {m:<8}", rep["fss"][m]["64.5"]["fss"])
    for thr, p in rep["prob"].items():
        print(f"P(>={thr}) BSS varsha={p['varsha']['bss']} auc={p['varsha']['auc']} | nwp BSS={p['nwp']['bss']} auc={p['nwp']['auc']}")
    rc = rep["regime_classifier"]
    print(f"Regime classifier acc={rc['accuracy']} macroF1={rc['macro_f1']} (rule {rc['rule_accuracy']}) by lead:",
          [b["accuracy"] for b in rc["by_lead"]])

    from varsha.export import export_all
    t = time.time()
    export_all(keep)
    print(f"exported dashboard data to {C.EXPORT_DIR} in {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
