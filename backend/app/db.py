"""SQLite storage. Schema is created on first run; safe to re-run."""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS hotspots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,                 -- 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT'
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    acq_datetime TEXT NOT NULL,           -- ISO8601 UTC
    confidence TEXT,                      -- VIIRS: 'l'/'n'/'h'; MODIS: integer 0-100
    brightness REAL,                      -- bright_ti4 or bright_t31 (Kelvin)
    frp REAL,                             -- fire radiative power (MW)
    daynight TEXT,                        -- 'D' or 'N'
    distance_mi REAL,                     -- from home point, denormalized for fast filtering
    raw_json TEXT,                        -- original record for debugging
    UNIQUE(source, latitude, longitude, acq_datetime)
);
CREATE INDEX IF NOT EXISTS idx_hotspots_acq_datetime ON hotspots(acq_datetime);
CREATE INDEX IF NOT EXISTS idx_hotspots_distance ON hotspots(distance_mi);

CREATE TABLE IF NOT EXISTS nws_alerts (
    id TEXT PRIMARY KEY,                  -- NWS alert id
    event TEXT NOT NULL,                  -- 'Red Flag Warning', 'Fire Weather Watch', etc.
    zones TEXT NOT NULL,                  -- comma-separated affected zones
    headline TEXT,
    description TEXT,
    sent_at TEXT NOT NULL,
    onset TEXT,
    expires TEXT,
    severity TEXT,
    raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_nws_alerts_expires ON nws_alerts(expires);

CREATE TABLE IF NOT EXISTS burn_bans (
    county TEXT PRIMARY KEY,              -- e.g. 'Lowndes'
    state TEXT NOT NULL,                  -- 'GA' or 'FL'
    in_effect INTEGER NOT NULL,           -- 0/1
    note TEXT,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drought (
    fetched_at TEXT PRIMARY KEY,
    county TEXT NOT NULL,
    intensity TEXT NOT NULL,              -- 'None', 'D0', 'D1', 'D2', 'D3', 'D4'
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS air_quality (
    fetched_at TEXT PRIMARY KEY,
    aqi INTEGER,
    category TEXT,                        -- 'Good', 'Moderate', etc.
    pm25 REAL,
    raw_json TEXT
);

CREATE TABLE IF NOT EXISTS alert_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sent_at TEXT NOT NULL,
    channel TEXT NOT NULL,                -- 'sms', 'email'
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    trigger_kind TEXT,                    -- 'hotspot_close', 'red_flag', etc.
    trigger_ref TEXT                      -- hotspot id or alert id
);
"""


@contextmanager
def conn():
    p = Path(settings.database_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(p)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db() -> None:
    with conn() as c:
        c.executescript(SCHEMA)
