"""Static geography: 0.25 deg grid, India/land/ocean masks, real terrain, coast distance,
windward-slope index and the grid-cell <-> district mapping."""
import json
import time
import urllib.request
from dataclasses import dataclass

import numpy as np
import shapely
from scipy import ndimage
from shapely.geometry import shape

from . import config as C


@dataclass
class Geo:
    lat: np.ndarray          # (NLAT,)
    lon: np.ndarray          # (NLON,)
    india: np.ndarray        # bool (NLAT, NLON) cell centre inside India
    land: np.ndarray         # bool, any land (Natural Earth)
    elev: np.ndarray         # m, smoothed to grid scale
    slope: np.ndarray        # m/km
    windward: np.ndarray     # m/km, upslope component of monsoon flow
    d_as: np.ndarray         # km to Arabian Sea
    d_bob: np.ndarray        # km to Bay of Bengal
    cell_district: np.ndarray  # int (NLAT, NLON), -1 outside India
    districts: list          # [{id,name,state,lat,lon,cells:[flat idx]}]

    @property
    def LAT(self):
        return np.repeat(self.lat[:, None], len(self.lon), axis=1)

    @property
    def LON(self):
        return np.repeat(self.lon[None, :], len(self.lat), axis=0)

    @property
    def idx(self):
        """Flat indices of India cells (the modelling domain)."""
        return np.flatnonzero(self.india.ravel())


def _grid():
    lat = C.LAT0 + C.RES * np.arange(C.NLAT)
    lon = C.LON0 + C.RES * np.arange(C.NLON)
    return lat, lon


def _mask_from_polys(polys, LAT, LON):
    m = np.zeros(LAT.shape, bool)
    for g in polys:
        minx, miny, maxx, maxy = g.bounds
        sel = (LON >= minx) & (LON <= maxx) & (LAT >= miny) & (LAT <= maxy)
        if sel.any():
            m[sel] |= shapely.contains_xy(g, LON[sel], LAT[sel])
    return m


def _get_json(url, tries=5):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=40) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(2 + 4 * attempt)
    raise RuntimeError("elevation API unreachable: " + url[:60])


def _fetch_elevation(lats, lons, verbose=True):
    """ETOPO1 (1 arc-min) samples via OpenTopoData (100 pts/request, 1 req/s);
    Open-Meteo (Copernicus DEM) as a second source."""
    out = np.zeros(len(lats))
    for s in range(0, len(lats), 100):
        la, lo = lats[s:s + 100], lons[s:s + 100]
        try:
            locs = "|".join(f"{a:.3f},{b:.3f}" for a, b in zip(la, lo))
            res = _get_json(f"https://api.opentopodata.org/v1/etopo1?locations={locs}")["results"]
            out[s:s + 100] = [r["elevation"] or 0.0 for r in res]
        except RuntimeError:
            q = (",".join(f"{a:.3f}" for a in la), ",".join(f"{b:.3f}" for b in lo))
            out[s:s + 100] = _get_json(
                f"https://api.open-meteo.com/v1/elevation?latitude={q[0]}&longitude={q[1]}")["elevation"]
        if verbose and (s // 100) % 20 == 0:
            print(f"    {s + len(la)}/{len(lats)} points")
        time.sleep(1.05)
    return out


def _analytic_elevation(LAT, LON):
    """Offline fallback: coarse Western Ghats / Himalaya / NE hills / Deccan relief."""
    wg_lon = 73.0 + (21.0 - LAT) * 0.33
    wg = 900 * np.exp(-((LON - wg_lon - 0.35) / 0.35) ** 2) * ((LAT > 8) & (LAT < 21.5))
    him_lat = 28.0 + (80 - LON) * 0.12
    him = 4500 / (1 + np.exp(-(LAT - him_lat) / 0.6))
    ne = 1200 * np.exp(-(((LAT - 25.4) / 0.4) ** 2 + ((LON - 91.5) / 1.2) ** 2))
    deccan = 500 * np.exp(-(((LAT - 17) / 5) ** 2 + ((LON - 77) / 3) ** 2))
    return wg + him + ne + deccan


def build_geo(verbose=True) -> Geo:
    C.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = C.CACHE_DIR / "geo.npz"
    dcache = C.CACHE_DIR / "districts.json"
    lat, lon = _grid()
    LAT = np.repeat(lat[:, None], len(lon), 1)
    LON = np.repeat(lon[None, :], len(lat), 0)
    if cache.exists() and dcache.exists():
        z = np.load(cache)
        return Geo(lat, lon, z["india"], z["land"], z["elev"], z["slope"], z["windward"],
                   z["d_as"], z["d_bob"], z["cell_district"], json.loads(dcache.read_text()))

    dist_fc = json.loads((C.DATA_DIR / "districts_full.geojson").read_text())
    dpolys = [shape(f["geometry"]).buffer(0) for f in dist_fc["features"]]
    land_fc = json.loads((C.DATA_DIR / "ne_50m_land.geojson").read_text())
    box = shapely.box(C.LON0 - 1, C.LAT0 - 1, C.LON1 + 1, C.LAT1 + 1)
    lpolys = [g for g in (shape(f["geometry"]) for f in land_fc["features"]) if g.intersects(box)]

    if verbose:
        print("  rasterising districts ...")
    cell_district = np.full(LAT.shape, -1, int)
    for i, g in enumerate(dpolys):
        minx, miny, maxx, maxy = g.bounds
        sel = (LON >= minx) & (LON <= maxx) & (LAT >= miny) & (LAT <= maxy) & (cell_district < 0)
        if sel.any():
            inside = shapely.contains_xy(g, LON[sel], LAT[sel])
            sub = cell_district[sel]
            sub[inside] = i
            cell_district[sel] = sub
    india = cell_district >= 0
    land = _mask_from_polys(lpolys, LAT, LON) | india

    # Terrain: real DEM samples for land cells (cached), analytic fallback offline
    ecache = C.CACHE_DIR / "elevation.npy"
    if ecache.exists():
        elev = np.load(ecache)
    else:
        elev = np.zeros(LAT.shape)
        try:
            if verbose:
                print(f"  fetching DEM for {land.sum()} land cells (ETOPO1 via OpenTopoData) ...")
            elev[land] = _fetch_elevation(LAT[land], LON[land])
        except Exception as e:  # pragma: no cover
            print("  DEM fetch failed, using analytic relief:", e)
            elev = np.where(land, _analytic_elevation(LAT, LON), 0.0)
        elev = np.clip(elev, 0, None)
        np.save(ecache, elev)
    elev_s = ndimage.gaussian_filter(elev, 0.8)
    gy, gx = np.gradient(elev_s, C.KM_PER_CELL)  # m/km (rows = lat)
    slope = np.hypot(gx, gy)
    # Monsoon low-level flow: WSW over the Arabian Sea side, SSW over the Bay side
    w = np.clip((LON - 82.0) / 6.0, 0, 1)
    u = (1 - w) * 0.94 + w * 0.45
    v = (1 - w) * 0.34 + w * 0.89
    windward = np.clip(u * gx + v * gy, 0, None)

    ocean = ~land
    as_mask = ocean & (LON < 77.5) & (LAT < 25)
    bob_mask = ocean & (LON > 79.5) & (LAT < 23.5)
    d_as = ndimage.distance_transform_edt(~as_mask) * C.KM_PER_CELL
    d_bob = ndimage.distance_transform_edt(~bob_mask) * C.KM_PER_CELL

    # District table + cell membership (districts smaller than a cell get their nearest cell)
    iy, ix = np.nonzero(india)
    districts = []
    for i, f in enumerate(dist_fc["features"]):
        p = f["properties"]
        rp = dpolys[i].representative_point()
        cells = np.flatnonzero((cell_district == i).ravel()).tolist()
        if not cells:
            k = np.argmin((LAT[iy, ix] - rp.y) ** 2 + (LON[iy, ix] - rp.x) ** 2)
            cells = [int(iy[k] * len(lon) + ix[k])]
        districts.append({"id": i, "name": p["name"], "state": p["state"],
                          "lat": round(rp.y, 3), "lon": round(rp.x, 3), "cells": cells})

    np.savez_compressed(cache, india=india, land=land, elev=elev_s, slope=slope, windward=windward,
                        d_as=d_as, d_bob=d_bob, cell_district=cell_district)
    dcache.write_text(json.dumps(districts))
    return Geo(lat, lon, india, land, elev_s, slope, windward, d_as, d_bob, cell_district, districts)


if __name__ == "__main__":
    g = build_geo()
    print("India cells:", g.india.sum(), "land cells:", g.land.sum(),
          "districts:", len(g.districts), "max elev:", g.elev.max().round())
