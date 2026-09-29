# VARSHA: strategy brief for SIH26080

**Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts** · MoES / NCMRWF

> **Check the deadline now.** On 30 Sep 2026 the SIH portal (https://sih.gov.in/sih2026PS) listed the idea-submission deadline for SIH26080 as **30 September 2026**. A third-party scrape gave 20 Sep. Confirm on the portal and submit the idea PPT first (see §9). The prototype in this repo is already enough for a live demo.

---

## 0. TL;DR

- **What we built.** VARSHA is an end-to-end prototype. It runs these steps:
  1. Reads a raw NWP rainfall forecast (0.25°, Day 1–5).
  2. **Classifies the synoptic regime**: Active, Break, Depression/Low, Coastal-Orographic, Western Disturbance or Normal.
  3. **Routes the forecast to regime-specific ML correction experts**, using soft gating.
  4. **Calibrates heavy, very heavy and extremely heavy rain probabilities**.
  5. Aggregates to **726 districts on India's official map**.
  6. Issues an **IMD-style Green/Yellow/Orange/Red 5-day district bulletin**.
  7. **Verifies everything** with RMSE, ETS, CSI, POD, FAR, FSS, Brier/BSS, reliability and a performance diagram.
- **Headline result.** Independent test seasons JJAS 2024–25, 5.7 M forecast–observation pairs:

  | Heavy rain (≥ 64.5 mm) | Raw NWP | VARSHA |
  |---|---|---|
  | ETS | 0.132 | **0.245 (+86%)** |
  | POD | 0.16 | **0.35** |
  | FSS @139 km | 0.38 | **0.58**, above the useful-skill line of 0.51 |

  RMSE also falls, from 13.5 to 12.8 mm/day.

  The regime-blind ML corrector and classical quantile mapping both do worse than VARSHA. That is the PS's hypothesis, demonstrated.
- **The honest part.** Real NCUM/NEPS hindcasts can't be downloaded in 24 h, so we built a **physically based monsoon digital twin**. It uses the real 0.25° India grid, real ETOPO1 terrain, the real coastline and the official district map. The NWP in the twin reproduces the **regime-dependent errors reported in the literature**. Every module has a **one-function swap** to IMD gridded rainfall plus real NCUM/GFS/ECMWF forecasts (§7). Say this upfront. Judges reward honesty and punish fake "real-time" claims.

---

## 1. Decoding the problem statement

### 1.1 What NCMRWF is really asking for
NCMRWF runs **NCUM** (12 km deterministic), **NEPS** (the ensemble) and the regional **NCUM-R**. IMD issues district heavy-rain warnings from these forecasts plus an MME. Their pain points:

1. **Errors are regime-dependent.** A monsoon depression's rain shield is displaced. Western Ghats rain is under-forecast because model terrain is smoothed. Break phases produce spurious central-India rain. A **single global bias correction averages these opposite errors away**.
2. **Heavy rain is where the models fail and where lives are lost.** Models over-predict drizzle and under-predict extremes, so the tail matters more than the mean.
3. **The output must fit operations.** That means district level, IMD thresholds, IMD colour codes, Day 1–5, and a verification report in their vocabulary: ETS, CSI, POD, FAR, FSS.

### 1.2 The five deliverables and how we cover each

| Expected outcome | VARSHA module | Where to see it |
|---|---|---|
| Weather regime classifier | Gradient-boosted classifier on 26 synoptic and regional predictors → P(6 regimes); explainable "why" signals; confusion matrix | Console → Regime engine; Regime Lab |
| Bias-corrected rainfall forecast | Soft-gated mixture of 6 regime experts + regime-aware trunk + per-regime frequency calibration | Console layers: Corrected / Correction Δ / swipe-compare |
| Heavy rainfall probability | Calibrated exceedance models for 64.5 / 115.6 / 204.5 mm (IMD heavy / very heavy / extremely heavy) | Console P(Heavy) / P(V.Heavy) layers, district drawer rings |
| District-level product | 726-district table and map, IMD colour code, 5-day matrix, CSV, printable bulletin, Hindi | District Bulletin tab, `/api/bulletin/{date}.csv` |
| Verification report | RMSE, MAE, bias, r, POD, FAR, CSI, ETS, FBI, HSS, FSS (6 scales), Brier, BSS, ROC-AUC, reliability, performance diagram, per lead, per regime, grid and district level | Verification tab, `report.json` download |

### 1.3 Hidden requirements judges will probe
- **Lead time.** Skill should decay gracefully from Day-1 to Day-5. Ours does, and we report skill per lead.
- **Double penalty.** A sharper corrected field is punished twice by RMSE when it's misplaced. You must show you understand the RMSE vs POD/ETS trade-off. We ship both a min-RMSE best estimate and a heavy-rain-tuned operational product (§3.4).
- **Calibration.** A "70%" should verify about 70% of the time. We show a reliability diagram.
- **No leakage.** We train on 2019–22, calibrate on 2023 and test on 2024–25. Gate probabilities used in training are leave-one-season-out.
- **Official map.** A government jury will notice a wrong J&K/Ladakh boundary. Ours includes Gilgit-Baltistan, Aksai Chin and PoK districts, following the official map.
- **IMD vocabulary.** Use the exact thresholds (64.5 / 115.6 / 204.5 mm per IMD SOP 2021, Table 1.5) and the colour code meanings: Green = No warning, Yellow = Watch / Be updated, Orange = Alert / Be prepared, Red = Warning / Take action.

---

## 2. Domain primer (for teammates new to meteorology)

| Regime | Synoptic picture | Typical NWP error | Correction idea |
|---|---|---|---|
| **Active** | Monsoon trough (Ganganagar → head Bay) south of normal, strong low-level jet (LLJ) | Trough rain placed too far north; peaks damped | Learn a southward shift and amplify peaks |
| **Break** | Trough at the Himalayan foothills; central India dry | Spurious central-India rain (false alarms); foothill/NE rain missed | Suppress central India; boost foothills and NE |
| **Depression / Low** | Bay of Bengal low moving WNW; heaviest rain in the **SW sector** (IMD monsoon FAQ) | Track displacement that grows with lead; symmetric, too-weak rain shield | Re-centre with directional offset predictors |
| **Coastal-Orographic** | Offshore trough/vortex; Konkan–Karnataka–Kerala deluge | Western Ghats windward rain under-forecast; spill-over to the lee | Terrain- and coast-aware re-concentration |
| **Western Disturbance** | Mid-latitude trough interacting with monsoon flow (e.g. Kedarnath 2013, Himachal 2023) | Rain pushed onto the plains, too weak on high terrain | Elevation-aware upslope shift |
| **Normal** | No dominant driver | Drizzle bias | Light-rain suppression |

**Objective active/break definition.** Rajeevan, Gadgil & Bhate (2010), *J. Earth Syst. Sci.* 119:229.
- Core monsoon zone: roughly 18–28°N, 65–88°E, land only.
- Standardised daily rainfall anomaly > +1 for ≥ 3 consecutive days = active; < −1 = break.
- Applied in July–August.

**IMD low-pressure scale** (by sustained wind): low < 17 kt; depression 17–27 kt; deep depression 28–33 kt; cyclonic storm ≥ 34 kt.

**IMD rainfall categories** (mm per 24 h, ending 0830 IST):

| Category | Range |
|---|---|
| Very light | trace–2.4 |
| Light | 2.5–15.5 |
| Moderate | 15.6–64.4 |
| Heavy | 64.5–115.5 |
| Very heavy | 115.6–204.4 |
| Extremely heavy | ≥ 204.5 |

**Accumulate NWP rainfall 03–03 UTC**, not 00–00 UTC, when you move to real data.

**Verification cheat-sheet.** H = hits, M = misses, F = false alarms, N = total.

| Score | Formula |
|---|---|
| POD | H / (H + M) |
| FAR | F / (H + F) |
| CSI | H / (H + M + F) |
| Frequency bias (FBI) | (H + F) / (H + M) |
| ETS | (H − Hr) / (H + M + F − Hr), where Hr = (H + M)(H + F)/N |

- **FSS** (Roberts & Lean 2008) = 1 − Σ(Pf − Po)² / Σ(Pf² + Po²). Pf and Po are the fractions of grid points above the threshold within each neighbourhood. Skill is "useful" when FSS ≥ 0.5 + f₀/2.
- **Performance diagram** (Roebber 2009): x = success ratio (1 − FAR), y = POD, CSI curves and bias rays. Up and to the right is better.

---

## 3. The VARSHA solution

### 3.1 Architecture

```
raw NWP (Day 1-5, 0.25°) ──► feature engine ──┬──► regime classifier ──► P(Active, Break, Dep, Oro, WD, Normal)
                                               │            │
                                               │            ▼ soft gate
                                               ├──► 6 regime experts + regime-aware trunk ──► VARSHA-mean (best estimate)
                                               │                                            └► per-regime frequency calibration ──► VARSHA (operational)
                                               └──► exceedance models (+regime probs) ──► isotonic ──► P(≥64.5 / 115.6 / 204.5)
                                                                                                     │
                     district aggregation (area mean, heaviest cell) ◄──────────────────────────────┘
                     ──► IMD colour code ──► 5-day bulletin / map / CSV / API ──► verification engine (feeds back)
```

### 3.2 Predictors
- **Cell predictors (27).** All come from the NWP field plus static geography:
  - value at the point;
  - 3/5/9/17-cell neighbourhood means;
  - 5/9-cell maxima and 5-cell standard deviation;
  - wet fraction and heavy fraction;
  - **directional offset means at ±1° and ±2° N/S/E/W**, which let an expert learn *systematic displacement*, e.g. depression tracks;
  - elevation, slope, **windward-slope index** (monsoon flow · ∇terrain), distance to the Arabian Sea and to the Bay;
  - lat, lon, lead, day of season.
- **Regime predictors (26)** are what a duty forecaster reads:
  - monsoon-trough latitude anomaly, 850 hPa LLJ, 850 hPa vorticity, minimum MSLP anomaly, west-coast offshore trough, WD 500 hPa trough, core-zone OLR;
  - area-mean NWP rain over 11 regions (core zone, west coast, NE, foothills, NW Himalaya, SE peninsula, Bay coast, central India, all-India, Arabian Sea offshore, Bay offshore);
  - heavy-rain area and centroid, maximum, spatial variability, lead, day of season.

### 3.3 Models, and why they're defensible
- **Gradient boosting** (scikit-learn HistGradientBoosting). It's fast, handles missing values, suits tabular data, trains on a laptop in minutes, and is explainable through permutation importance. LightGBM or XGBoost are drop-in replacements.
- **Poisson loss** suits non-negative, skewed rainfall. Heavy-rain rows are oversampled with **inverse-probability weights**, so the mean stays unbiased.
- **Soft-gated mixture of experts.**
  - Each expert trains on all rows, weighted by that regime's out-of-fold gate probability. Training therefore sees the same imperfect routing as inference.
  - A **shared regime-aware trunk** (the same model with regime probabilities as inputs) is averaged in to cut variance.
  - Prior art: this is the ML generalisation of **ECMWF ecPoint**'s "weather-type-dependent" calibration (Hewson & Pillosu 2021) and of **regime-dependent post-processing** (Allen, Ferro & Kwasniok 2019, *QJRMS*).
- **Frequency calibration.** A per-regime quantile map from the mean prediction to the observed distribution restores extremes.
  - The blend weight α is picked on the calibration season to **maximise ETS@64.5 subject to RMSE staying below raw NWP**.
  - The pipeline chose α = 0.4.
- **Exceedance probabilities.** Gradient-boosted classifiers with regime probabilities as inputs, **isotonic-calibrated** on an independent season.
- **Safety guard.** Every ML output is capped at 3× the NWP 9×9-neighbourhood maximum (floor 80 mm) and 500 mm/day. This came from a real failure: an unguarded log-link model once produced 3,042 mm on one day.

### 3.4 Two products, on purpose (the double-penalty answer)
- **VARSHA-mean** is the conditional mean. It has the lowest RMSE (12.31 vs 13.50 raw), but like any mean it is smooth and under-forecasts extremes.
- **VARSHA (operational)** is frequency-calibrated. It trades a little RMSE for much better heavy-rain detection. It still beats raw on RMSE and more than doubles POD.

Say it in one line: *"Use VARSHA-mean for quantity forecasts, and VARSHA plus the probabilities for warnings."*

### 3.5 District product and warning logic
- District rainfall is the area mean of its 0.25° cells, plus the heaviest cell. The heaviest cell captures "heavy rain at isolated places".
- The colour comes from the calibrated probabilities at the heaviest cell. This mirrors IMD's probability-impact matrix:

| Colour | Rule |
|---|---|
| Yellow | P(heavy) ≥ 30% |
| Orange | P(heavy) ≥ 60% or P(very heavy) ≥ 30% |
| Red | P(very heavy) ≥ 60% or P(extremely heavy) ≥ 35% |

- IMD's own SOP phrasing: "likely" = 25–50%, "very likely" = 50–75%, "most likely" > 75%. Tune the thresholds with IMD if needed.

---

## 4. Results (digital twin, independent test seasons JJAS 2024 & 2025)

244 days × 5 leads × 4,643 grid cells = **5.66 M pairs**. Train 2019–22, calibrate 2023, test 2024–25.

| All leads | Raw NWP | Quantile mapping | Global ML (regime-blind) | Regime QM | VARSHA-mean | **VARSHA** |
|---|---|---|---|---|---|---|
| RMSE (mm/d) ↓ | 13.50 | 15.46 | 12.62 | 15.85 | **12.31** | 12.81 |
| Correlation ↑ | 0.588 | 0.564 | 0.654 | 0.555 | **0.675** | 0.665 |
| ETS ≥ 15.6 ↑ | 0.308 | 0.311 | 0.366 | 0.313 | 0.383 | **0.383** |
| POD ≥ 64.5 ↑ | 0.160 | 0.303 | 0.234 | 0.322 | 0.266 | **0.354** |
| FAR ≥ 64.5 ↓ | 0.531 | 0.659 | **0.443** | 0.670 | 0.445 | 0.539 |
| CSI ≥ 64.5 ↑ | 0.136 | 0.191 | 0.197 | 0.195 | 0.219 | **0.251** |
| ETS ≥ 64.5 ↑ | 0.132 | 0.185 | 0.193 | 0.189 | 0.215 | **0.245** |
| Freq. bias ≥ 64.5 (→1) | 0.34 | 0.89 | 0.42 | 0.97 | 0.48 | 0.77 |
| ETS ≥ 115.6 ↑ | 0.060 | 0.151 | 0.114 | 0.149 | 0.140 | **0.179** |
| FSS ≥ 64.5 @139 km ↑ (useful ≥ 0.506) | 0.384 | 0.479 | 0.491 | 0.480 | 0.532 | **0.581** |

Probabilistic skill vs the raw-NWP neighbourhood probability (5×5 cells):

| Threshold | VARSHA BSS | VARSHA ROC-AUC | NWP BSS | NWP ROC-AUC |
|---|---|---|---|---|
| ≥ 64.5 mm | 0.234 | 0.957 | 0.071 | 0.643 |
| ≥ 115.6 mm | 0.140 | 0.965 | 0.042 | 0.575 |

**Regime classifier.** 83.0% accuracy, macro-F1 0.81, against 41% for a fixed-threshold rule baseline. By lead: Day-1 87.7% → Day-5 78.7%.

**ETS ≥ 64.5 by regime:**

| Regime | Raw → Global ML → VARSHA |
|---|---|
| Active | 0.071 → 0.127 → **0.175** |
| Break | 0.054 → 0.141 → **0.229** |
| Depression | 0.252 → 0.262 → **0.317** |
| Orographic | 0.132 → 0.280 → **0.308** |
| WD | 0.165 → 0.267 → **0.274** |
| Normal | 0.062 → 0.119 → **0.158** |

VARSHA beats the regime-blind ML corrector in every regime. That's the regime-awareness gain.

**Be upfront about the weak spots:**
- FAR at 64.5 is flat (0.539 vs 0.531) while POD more than doubles. That's the detection trade-off, and CSI and ETS capture it net.
- Normal-regime RMSE is 2% worse than raw.
- These are digital-twin numbers. Real-data skill will differ. The *method* and the *verification framework* are what transfer.

---

## 5. Why this wins: differentiators to emphasise
1. **It answers the exact hypothesis.** The Regime Atlas shows the raw-NWP bias map *per regime*, and each has a different shape. The scorecard shows the regime-blind ML losing to the regime-aware system in all six regimes.
2. **Operational fidelity.**
   - IMD thresholds, IMD colour codes and SOP terms (Watch, Alert, Warning).
   - 0830 IST convention, Day 1–5, district matrix bulletin, CSV, print, Hindi.
   - Official India boundary.
3. **Verification rigour at the level NCMRWF itself uses.** Performance diagram, FSS against the useful-skill line, reliability diagrams, per-lead and per-regime scores, district-scale scores, six baselines, and a strict temporal split.
4. **Explainability.** Regime probabilities, a "why" panel of the strongest signals as z-scores, permutation importance, and "routed to expert #k".
5. **Wow demo.** Boot sequence, a live warnings ticker, a regime DNA ribbon over the season, one-click replay of the whole monsoon, and depression tracking with the NWP centre error in km.
   - The map has grid, 3D-tower and swipe-compare modes.
   - The district drawer shows forecast evolution D-5 → D-1.
6. **Production-shaped.**
   - FastAPI with an OpenAPI spec, `/api/forecast`, `/api/bulletin.csv` and `/api/regime/classify` (live model).
   - Static export for offline demos.
   - A single-command run.

---

## 6. Judge Q&A prep

| Likely question | Crisp answer |
|---|---|
| **Is this real data?** | "The geography, terrain, district map and IMD thresholds are real. The weather is a physically based digital twin with the documented NWP error behaviours, because NCUM/NEPS hindcasts aren't openly downloadable in 24 h. `simulate_year()` is one function; swap it for IMD gridded rainfall and NCUM forecasts and nothing else changes. If you can share NCUM hindcasts, we can retrain in hours." |
| How would you get regime labels in reality? | Active/break from the Rajeevan (2010) objective index on IMD gridded rainfall; lows and depressions from the IMD RSMC best tracks/e-Atlas; WDs from IMD daily weather reports or a z500 trough index from reanalysis; orographic/offshore-trough days from west-coast rain and the offshore-trough index. We could also cluster reanalysis fields (k-means/SOM) to discover regimes. |
| Why gradient boosting, not deep learning? | It's tabular, fast, explainable and data-efficient, and it trains on a laptop in minutes. Stage 2 is a regime-conditioned U-Net for spatial structure. The gating architecture stays the same. |
| Why doesn't FAR improve? | Raw NWP rarely forecasts heavy rain (frequency bias 0.34), so it has few false alarms but misses 84% of events. VARSHA brings frequency bias to 0.77 and doubles POD at the same FAR, which gives a big CSI/ETS gain. For a lower FAR, use VARSHA-mean (FAR 0.445) or raise the warning probability thresholds. |
| Double penalty? | Yes, which is why we ship two products and the FSS. See §3.4. |
| What if the classifier is wrong? | Soft gating: a 60/40 day blends two experts. Experts were trained on out-of-fold gate probabilities, so they've seen misrouting. The classifier drops from 88% at Day-1 to 79% at Day-5 and the correction degrades gracefully. |
| New or unseen regimes (e.g. a cyclone landfall)? | Fall back to the shared trunk when max P(regime) < θ; flag low confidence; monitor drift; add regimes such as Cyclone and Monsoon onset. |
| Computational cost? | The full pipeline (simulate 7 seasons, train 13 models, verify 5.7 M pairs, export) takes about 5 minutes on a laptop. Daily inference for all of India takes seconds. |
| Ensembles (NEPS)? | Run VARSHA on each member → calibrated member-wise probabilities, or add ensemble mean and spread as predictors (EMOS-style). |
| Why 0.25°? | It matches IMD gridded rainfall (Pai et al. 2014), the reference truth for verification. NCUM at 12 km is conservatively regridded to 0.25°. |
| Map boundary source? | Survey-of-India-compliant district GeoJSON (includes PoK, Gilgit-Baltistan, Aksai Chin). We can swap in IMD's own district layer. |
| How does this help a District Collector? | They get a colour-coded 5-day bulletin in English or Hindi, a probability instead of a yes/no, and the reason ("Depression, expert #3"). All of it is available as CSV, API or print. |

---

## 7. Real-data upgrade path (pilot, 1–4 weeks)

1. **Truth.** IMD 0.25° gridded daily rainfall:
   - `pip install imdlib`, then `imdlib.get_data('rain', 2015, 2024, fn_format='yearwise')`.
   - Or download from https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html. Download from inside India; it can time out abroad.
2. **Forecasts.** Pick one:
   - **NCMRWF NCUM/NEPS.** Ask the problem-statement owners; there is no open bulk archive. IMDAA reanalysis is at https://rds.ncmrwf.gov.in.
   - **GFS 0.25°** on AWS `s3://noaa-gfs-bdp-pds`, from 2021. Use APCP, accumulated 03–03 UTC per lead.
   - **ECMWF open data** on AWS `s3://ecmwf-forecasts`, from 2023.
   - **Fastest pilot:** the Open-Meteo **Previous Runs API**. `precipitation_previous_day1..5` gives true lead-time forecasts from Jan 2024 at points. Use district centroids.
3. **Regime labels.** See §6.
4. **Code change.** Write a `load_year(year)` that returns the same dict as `simulate_year()`:
   - `obs[T,NY,NX]`, `fc[L,T,NY,NX]`, `regimes[T]`, `idx_fc[L,T,7]`
   - compute `idx_fc` from reanalysis/forecast fields
   - then run `run_pipeline.py` unchanged.

---

## 8. 24-hour team plan (6 members)

| Hours | Backend/ML (2) | Frontend (2) | Domain + pitch (2) |
|---|---|---|---|
| 0–2 | Run `./setup.sh && ./run.sh`; read `pipeline.py` | Run `./dev.sh`; learn the 5 tabs | Read this brief; fill the SIH idea PPT (§9) and **submit** |
| 2–8 | Real-data spike: Open-Meteo previous-runs for 50 districts, IMD obs via imdlib → mini verification table | Polish the demo path; add an "Upload NWP CSV → corrected" widget via FastAPI | Build the regime catalogue for JJAS 2024 (IMD weekly weather reports, RSMC tracks) |
| 8–14 | Rajeevan index on IMD obs; LightGBM swap; SHAP per district | Mobile-responsive bulletin; WhatsApp-style share card | Rehearse the 3-min demo; prepare Q&A |
| 14–20 | Hardening: tests on metrics (FSS/ETS against a hand-computed example), timing | Record a fallback demo video; freeze the build | Slides: problem → insight → demo → results → roadmap |
| 20–24 | Buffer / sleep | Buffer | Dry runs ×3 |

**Minimum demo that must never break:** `./run.sh` → open http://localhost:8000. Keep a screen recording as backup.

---

## 9. Idea-submission PPT (SIH template), slide by slide

1. **Title.** VARSHA: Regime-Aware AI Post-Processing of Monsoon Rainfall · SIH26080 · team name.
2. **Problem and insight.** NWP errors change sign and shape by regime (show the Regime Atlas image). One correction averages them out, and heavy rain is missed: raw POD is 0.16.
3. **Solution.** The architecture diagram (How-it-works tab): regime classifier → soft-gated experts → calibration → probabilities → district colour code → verification.
4. **Technical approach.**
   - Stack: Python, scikit-learn GBM, FastAPI, React, deck.gl.
   - Data: IMD 0.25° gridded rainfall, NCUM/NEPS, IMDAA.
   - Predictors, and the train/calibrate/test split.
5. **Feasibility and results.**
   - Prototype screenshots.
   - ETS 0.13 → 0.25; POD 0.16 → 0.35; FSS above the useful line; BSS 0.07 → 0.23.
   - Clearly marked "digital-twin evaluation"; real-data pilot plan.
6. **Impact and benefits.** District collectors and SDMAs, agriculture, reservoirs, urban flooding. Hindi bulletins. API for the IMD/NCMRWF pipeline. Scales to NEPS ensembles and nowcasting.
7. **References.** §11.

## 10. 3-minute live demo script

1. **0:00** Boot screen → Console on the "Monsoon depression" event.
   - "The raw model put this low 122 km off. VARSHA knows it's a depression regime with 100% confidence, routes to expert #3, and restores the SW-sector heavy rain."
2. **0:40** Swipe-compare raw vs corrected, then toggle **P(Heavy)** and **Warnings**.
   - "94 districts got heavy rain. Raw NWP flagged 63, VARSHA flagged 82."
3. **1:10** Click Angul (Odisha): probability rings, 5-day outlook, forecast evolution D-5 → D-1.
4. **1:30** Press **Play** to replay the season. The regime ribbon shows predicted vs observed regimes.
5. **1:50** **Regime Lab**: "Each regime's bias has its own shape; that's why one correction fails." Show the confusion matrix and importance.
6. **2:20** **Verification**: hero tiles, the performance-diagram arrow, FSS crossing the useful line, the reliability diagram.
7. **2:45** **District Bulletin** → हिं toggle → Print. Close on the roadmap.

## 11. References
- IMD, *SOP for Weather Forecasting & Warning* (2021): thresholds (Table 1.5), colour codes (§1.7.8). https://mausam.imd.gov.in/imd_latest/contents/pdf/forecasting_sop.pdf
- Rajeevan, Gadgil & Bhate (2010), Active and break spells of the Indian summer monsoon, *J. Earth Syst. Sci.* 119:229. https://doi.org/10.1007/s12040-010-0019-4
- Pai et al. (2014), IMD 0.25° gridded rainfall, *MAUSAM* 65:1–18.
- Mukhopadhyay et al. (2019), GFS T1534 performance over India, *J. Earth Syst. Sci.* 128:155. https://doi.org/10.1007/s12040-019-1186-6
- Sharma, Ashrit et al. (2017), NGFS/NCUM/ACCESS-G verification, *MAUSAM* 68(4).
- Ashrit et al. (2020), NCUM for the Kerala floods, *Meteorol. Appl.* https://doi.org/10.1002/met.1906
- Nageswararao, Zhu & Tallapragada (2022), GEFSv12 over India, *Wea. Forecasting*. https://doi.org/10.1175/WAF-D-21-0184.1
- Roy Bhowmik & Durai (2010), IMD MME district forecasts, *Meteorol. Atmos. Phys.* 106:19. https://doi.org/10.1007/s00703-009-0047-2
- Allen, Ferro & Kwasniok (2019), Regime-dependent statistical post-processing, *QJRMS* 145:3535. https://doi.org/10.1002/qj.3638
- Hewson & Pillosu (2021), ecPoint, *Commun. Earth Environ.* https://doi.org/10.1038/s43247-021-00185-9
- Vannitsem et al. (2021), Statistical post-processing review, *BAMS*. https://doi.org/10.1175/BAMS-D-19-0308.1
- Roberts & Lean (2008), Fractions Skill Score, *Mon. Wea. Rev.* 136:78. https://doi.org/10.1175/2007MWR2123.1
- Roebber (2009), Performance diagram, *Wea. Forecasting* 24:601. https://doi.org/10.1175/2008WAF2222159.1
- WWRP/WGNE JWGFVR verification methods: https://jwgfvr.github.io/forecastverification
