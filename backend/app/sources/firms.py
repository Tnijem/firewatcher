"""NASA FIRMS satellite hotspot poller.

API docs: https://firms.modaps.eosdis.nasa.gov/api/area/

Endpoint: /api/area/csv/{MAP_KEY}/{SOURCE}/{W,S,E,N}/{DAYS}/{START_DATE?}
- SOURCE options: VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT, MODIS_NRT
- DAYS: 1..10 lookback window
"""
from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone

import httpx

from ..config import settings
from ..db import conn
from ..geo import haversine_mi

log = logging.getLogger(__name__)

SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"]
LOOKBACK_DAYS = 5  # FIRMS area API caps day_range at 5 for these sources
BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


def _bbox() -> str:
    return f"{settings.bbox_west},{settings.bbox_south},{settings.bbox_east},{settings.bbox_north}"


def _parse_acq_datetime(date_str: str, time_str: str) -> str:
    """FIRMS gives acq_date='YYYY-MM-DD' and acq_time='HHMM' (UTC). Return ISO."""
    t = time_str.zfill(4)
    dt = datetime.strptime(f"{date_str} {t}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
    return dt.isoformat()


async def fetch_source(client: httpx.AsyncClient, source: str) -> list[dict]:
    if not settings.firms_map_key:
        log.warning("FIRMS_MAP_KEY not set; skipping FIRMS poll")
        return []
    url = f"{BASE}/{settings.firms_map_key}/{source}/{_bbox()}/{LOOKBACK_DAYS}"
    r = await client.get(url, timeout=30)
    r.raise_for_status()
    text = r.text.strip()
    if not text or text.startswith("Invalid"):
        log.warning("FIRMS %s returned: %s", source, text[:100])
        return []
    rows = list(csv.DictReader(io.StringIO(text)))
    log.info("FIRMS %s: %d rows", source, len(rows))
    return rows


async def poll_all() -> int:
    """Fetch all FIRMS sources, dedupe-insert into hotspots. Returns rows inserted."""
    inserted = 0
    async with httpx.AsyncClient() as client:
        for src in SOURCES:
            try:
                rows = await fetch_source(client, src)
            except Exception as e:
                log.exception("FIRMS %s failed: %s", src, e)
                continue
            inserted += _store_rows(src, rows)
    return inserted


def _store_rows(source: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    with conn() as c:
        cur = c.cursor()
        n = 0
        for r in rows:
            try:
                lat = float(r["latitude"])
                lon = float(r["longitude"])
                acq = _parse_acq_datetime(r["acq_date"], r["acq_time"])
                bright = r.get("bright_ti4") or r.get("brightness")
                cur.execute(
                    """INSERT OR IGNORE INTO hotspots
                       (source, latitude, longitude, acq_datetime, confidence,
                        brightness, frp, daynight, distance_mi, raw_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        source,
                        lat,
                        lon,
                        acq,
                        r.get("confidence"),
                        float(bright) if bright else None,
                        float(r["frp"]) if r.get("frp") else None,
                        r.get("daynight"),
                        haversine_mi(settings.home_lat, settings.home_lon, lat, lon),
                        json.dumps(r),
                    ),
                )
                if cur.rowcount > 0:
                    n += 1
            except (KeyError, ValueError) as e:
                log.warning("skipping bad FIRMS row: %s", e)
        return n
