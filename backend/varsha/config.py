"""Central configuration: grid, regimes, IMD thresholds, experiment split."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
EXPORT_DIR = ROOT / "frontend" / "public" / "data"
MODEL_DIR = ROOT / "backend" / "models"

# 0.25 deg grid - same resolution as IMD gridded rainfall (Pai et al. 2014)
RES = 0.25
LAT0, LAT1 = 6.5, 37.25
LON0, LON1 = 68.0, 97.5
NLAT = int(round((LAT1 - LAT0) / RES)) + 1
NLON = int(round((LON1 - LON0) / RES)) + 1
KM_PER_CELL = 27.8

# Monsoon season (JJAS); synthetic "digital twin" seasons
SEASON_DAYS = 122  # 1 Jun .. 30 Sep
YEARS = list(range(2019, 2026))
TRAIN_YEARS = [2019, 2020, 2021, 2022]   # experts are fit here
CALIB_YEARS = [2023]                     # calibration (QM / isotonic) fit here
TEST_YEARS = [2024, 2025]                # every reported score is on these
LEADS = [1, 2, 3, 4, 5]

# IMD daily rainfall intensity categories (mm/day)
IMD_CATEGORIES = [
    {"key": "none", "label": "No rain", "min": 0.0},
    {"key": "vlight", "label": "Very light", "min": 0.1},
    {"key": "light", "label": "Light", "min": 2.5},
    {"key": "moderate", "label": "Moderate", "min": 15.6},
    {"key": "heavy", "label": "Heavy", "min": 64.5},
    {"key": "vheavy", "label": "Very heavy", "min": 115.6},
    {"key": "xheavy", "label": "Extremely heavy", "min": 204.5},
]
VERIF_THRESHOLDS = [2.5, 15.6, 64.5, 115.6]
HEAVY = 64.5
VHEAVY = 115.6
XHEAVY = 204.5
FSS_SCALES = [1, 3, 5, 9, 15, 25]  # window widths in grid cells (0.25 .. 6.25 deg)

REGIMES = [
    {"id": 0, "key": "ACTIVE", "name": "Active Monsoon", "short": "Active", "color": "#3987e5",
     "desc": "Monsoon trough south of normal, strong low-level jet; widespread heavy rain over central India and the west coast."},
    {"id": 1, "key": "BREAK", "name": "Break Monsoon", "short": "Break", "color": "#c98500",
     "desc": "Trough shifts to the Himalayan foothills; central India dry, rain over the foothills, NE India and the SE peninsula."},
    {"id": 2, "key": "DEPRESSION", "name": "Monsoon Low / Depression", "short": "Depression", "color": "#d55181",
     "desc": "Low pressure system from the Bay of Bengal moving WNW; very heavy rain in its south-west sector."},
    {"id": 3, "key": "OROGRAPHIC", "name": "Coastal-Orographic", "short": "Orographic", "color": "#008300",
     "desc": "Offshore trough / vortex; intense rain on the Konkan-Karnataka-Kerala coast and the Western Ghats windward slopes."},
    {"id": 4, "key": "WD", "name": "Western Disturbance", "short": "W. Disturbance", "color": "#9085e9",
     "desc": "Mid-latitude trough interacting with monsoon flow; heavy rain over J&K, Himachal, Uttarakhand and Punjab."},
    {"id": 5, "key": "NORMAL", "name": "Normal / Transition", "short": "Normal", "color": "#8a8980",
     "desc": "Near-climatological monsoon flow without a dominant synoptic driver."},
]
NREG = len(REGIMES)

SEED = 42
