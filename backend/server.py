"""VARSHA API + dashboard server.

    .venv/bin/python server.py            # http://localhost:8000  (dashboard + API docs at /docs)

Endpoints read the exported products (frontend/public/data) and the trained models (backend/models).
"""
import csv
import io
import json
from datetime import date, timedelta
from functools import lru_cache

import joblib
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from varsha import config as C
from varsha.features import REGIME_FEATURES

DATA = C.EXPORT_DIR
DIST = C.ROOT / "frontend" / "dist"
WARN = ["Green", "Yellow", "Orange", "Red"]

app = FastAPI(title="VARSHA API", version="0.1.0",
              description="Regime-aware AI post-processing of NWP rainfall forecasts (SIH26080).")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@lru_cache(maxsize=512)
def _json(rel: str):
    p = DATA / rel
    if not p.exists():
        raise HTTPException(404, f"{rel} not found - run run_pipeline.py")
    return json.loads(p.read_text())


@lru_cache(maxsize=1)
def _models():
    return joblib.load(C.MODEL_DIR / "varsha_models.joblib")


@app.get("/api/health")
def health():
    meta = _json("meta.json")
    return {"status": "ok", "mode": meta["app"]["mode"], "dates": [meta["dates"][0], meta["dates"][-1]],
            "districts": len(meta["districts"]), "regimes": [r["key"] for r in meta["regimes"]]}


@app.get("/api/meta")
def meta():
    return _json("meta.json")


@app.get("/api/verification")
def verification():
    return _json("verification.json")


@app.get("/api/forecast/{valid_date}")
def forecast(valid_date: str, lead: int = 1):
    """District forecast valid on `valid_date` at `lead` days: rain (mean/max), probabilities, IMD colour."""
    if lead not in C.LEADS:
        raise HTTPException(400, "lead must be 1..5")
    day = _json(f"days/{valid_date}.json")
    meta = _json("meta.json")
    li = lead - 1
    P = day["pred"][li]
    k = int(np.argmax(P))
    d = day["d"]
    return {
        "valid_date": valid_date, "lead_days": lead,
        "issued": (date.fromisoformat(valid_date) - timedelta(days=lead)).isoformat(),
        "regime": {"predicted": meta["regimes"][k]["key"], "probabilities": dict(zip([r["key"] for r in meta["regimes"]], P))},
        "districts": [{
            "id": x["id"], "district": x["name"], "state": x["state"],
            "raw_mm": d["raw"][li][i], "corrected_mm": d["cor"][li][i], "corrected_max_mm": d["corx"][li][i],
            "p_heavy": d["ph"][li][i] / 100, "p_very_heavy": d["pvh"][li][i] / 100, "p_extremely_heavy": d["pxh"][li][i] / 100,
            "warning": WARN[d["warn"][li][i]],
        } for i, x in enumerate(meta["districts"])],
    }


@app.get("/api/district/{district_id}")
def district(district_id: int):
    return _json(f"series/{district_id}.json")


@app.get("/api/bulletin/{issue_date}.csv")
def bulletin(issue_date: str):
    """IMD-style 5-day district heavy-rainfall warning matrix as CSV."""
    meta = _json("meta.json")
    days = []
    for L in C.LEADS:
        ds = (date.fromisoformat(issue_date) + timedelta(days=L)).isoformat()
        days.append((ds, _json(f"days/{ds}.json") if ds in meta["dates"] else None))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["district", "state"] + [f"day{L}_{ds}_{f}" for L, (ds, _) in zip(C.LEADS, days) for f in ("warning", "p_heavy", "max_mm")])
    for i, x in enumerate(meta["districts"]):
        row = [x["name"], x["state"]]
        for li, (_, dd) in enumerate(days):
            row += ["NA", "", ""] if dd is None else [WARN[dd["d"]["warn"][li][i]], dd["d"]["ph"][li][i], dd["d"]["corx"][li][i]]
        w.writerow(row)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=varsha_bulletin_{issue_date}.csv"})


class RegimeQuery(BaseModel):
    features: dict[str, float]


@app.get("/api/regime/features")
def regime_features():
    return {"features": REGIME_FEATURES}


@app.post("/api/regime/classify")
def classify(q: RegimeQuery):
    """Live regime classification from synoptic predictors (missing ones -> NaN, handled natively)."""
    clf = _models()["classifier"]
    x = np.array([[q.features.get(f, np.nan) for f in REGIME_FEATURES]], float)
    P = clf.predict_proba(x)[0]
    return {"probabilities": {r["key"]: round(float(p), 4) for r, p in zip(C.REGIMES, P)},
            "regime": C.REGIMES[int(np.argmax(P))]["key"], "missing": [f for f in REGIME_FEATURES if f not in q.features]}


# static products + built dashboard
if DATA.exists():
    app.mount("/data", StaticFiles(directory=DATA), name="data")
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
