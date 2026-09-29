# VARSHA · Regime-Aware Monsoon Rainfall Intelligence

**SIH26080 (MoES / NCMRWF): Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts**

VARSHA runs in five steps:
1. It identifies the prevailing **weather regime**: Active, Break, Monsoon Low/Depression, Coastal-Orographic, Western Disturbance or Normal.
2. It routes the raw NWP rainfall forecast to **regime-specific ML correction experts**.
3. It produces **calibrated heavy-rain probabilities**.
4. It publishes an **IMD-style district warning bulletin**.
5. It **verifies everything** (RMSE, ETS, CSI, POD, FAR, FSS, Brier, reliability).

→ Strategy, results, judge Q&A and the 24-h plan are in **[docs/BRAINSTORM.md](docs/BRAINSTORM.md)**.

## Quick start

Requires Python ≥ 3.10 and Node ≥ 18.

```bash
./setup.sh      # venv + pip install + npm install
./run.sh        # first run trains the models (~5 min), builds the dashboard, serves http://localhost:8000
./dev.sh        # optional: hot-reload UI on http://localhost:5173
```

The repo already contains the exported data (`frontend/public/data`) and the trained models (`backend/models`). That means `./dev.sh` works immediately after `npm install`. Use `./run.sh --retrain` to regenerate everything.

**Windows (PowerShell):**
```powershell
cd backend; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python run_pipeline.py        # optional: data is already exported
cd ..\frontend; npm install; npx vite build
cd ..\backend; .venv\Scripts\python server.py   # http://localhost:8000
```

## What's inside

```
backend/
  varsha/config.py      grid (0.25°), IMD thresholds, regimes, train/calib/test split
  varsha/geo.py         India grid, official district map → cell mapping, ETOPO1 terrain, coast distance, windward index
  varsha/simulate.py    monsoon digital twin: regimes, observed rain, NWP with regime-dependent errors  ← swap for real data
  varsha/features.py    27 cell predictors + 26 synoptic/regional regime predictors
  varsha/models.py      regime classifier, soft-gated experts, regime-aware trunk, quantile maps, exceedance models
  varsha/verify.py      RMSE/MAE/bias/r, POD/FAR/CSI/ETS/FBI/HSS, FSS, Brier/BSS/reliability/AUC
  varsha/pipeline.py    end-to-end experiment with a leakage-free split
  varsha/export.py      static data contract for the dashboard
  run_pipeline.py       train + verify + export
  server.py             FastAPI: /api/forecast, /api/bulletin/{date}.csv, /api/regime/classify, /docs
frontend/               React + TypeScript + deck.gl + Tailwind + Recharts + motion
  src/pages/Console     live map (district / grid / 3D towers / swipe), regime engine, situation report, season replay
  src/pages/Districts   5-day IMD colour-coded district bulletin, CSV, print, हिं
  src/pages/RegimeLab   regime atlas (bias maps per regime), classifier diagnostics, regime playbook
  src/pages/Verification scorecard, performance diagram, FSS vs scale, ETS by lead, per-regime dumbbells, reliability
  src/pages/About       animated architecture, data provenance, roadmap
data/                   official-boundary district and state GeoJSON, Natural Earth land, caches
docs/BRAINSTORM.md      the strategy brief
```

## Results (digital twin, independent test seasons JJAS 2024–25, 5.7 M pairs)

| | Raw NWP | Quantile mapping | Regime-blind ML | **VARSHA** |
|---|---|---|---|---|
| RMSE (mm/day) | 13.50 | 15.46 | 12.62 | **12.81** (VARSHA-mean 12.31) |
| ETS ≥ 64.5 mm | 0.132 | 0.185 | 0.193 | **0.245** |
| POD ≥ 64.5 mm | 0.160 | 0.303 | 0.234 | **0.354** |
| CSI ≥ 64.5 mm | 0.136 | 0.191 | 0.197 | **0.251** |
| FSS ≥ 64.5 @139 km | 0.384 | 0.479 | 0.491 | **0.581** |
| BSS P(≥ 64.5) | 0.071* | – | – | **0.234** |

\* The raw-NWP value is for its 5×5 neighbourhood probability.

The regime classifier reaches 83% accuracy (macro-F1 0.81), against 41% for a threshold-rule baseline.

## Data honesty

- **Real:**
  - 0.25° India grid;
  - ETOPO1 terrain (fetched once from OpenTopoData and cached);
  - Natural Earth coastline;
  - 726 districts following the official Survey-of-India boundary (from `udit-001/india-maps-data`);
  - IMD thresholds and colour codes.
- **Simulated:** daily weather and NWP forecasts. `varsha/simulate.py` builds a monsoon digital twin whose NWP reproduces the regime-dependent errors reported in the literature, because NCUM/NEPS hindcasts aren't openly available.
- **Swap in real data** by implementing `load_year(year)` with the same return dict as `simulate_year()`: IMD gridded rainfall via `imdlib`, plus NCUM / GFS / ECMWF / Open-Meteo previous-runs forecasts. Everything downstream is unchanged. See [docs/BRAINSTORM.md §7](docs/BRAINSTORM.md).

## API (FastAPI, http://localhost:8000/docs)

| Endpoint | What it returns |
|---|---|
| `GET /api/health` | status, date range, regimes |
| `GET /api/forecast/{YYYY-MM-DD}?lead=1..5` | per-district raw/corrected rain, P(heavy / very heavy / extremely heavy), IMD colour, regime probabilities |
| `GET /api/bulletin/{issue-date}.csv` | 5-day district warning matrix |
| `GET /api/district/{id}` | season time series (obs vs raw vs corrected) |
| `POST /api/regime/classify` | live regime probabilities from `{"features": {"vort850": 9, "mslp_min_anom": -8, ...}}` |
| `GET /api/verification` | full verification report |
