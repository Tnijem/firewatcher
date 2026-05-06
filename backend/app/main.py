from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import conn, init_db
from .scheduler import build_scheduler
from .sources import firms, nws

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    sched = build_scheduler()
    sched.start()
    # Kick off an initial fetch so the dashboard isn't empty on first launch.
    await firms.poll_all()
    await nws.poll_all()
    log.info("startup complete; scheduler running")
    yield
    sched.shutdown(wait=False)


app = FastAPI(title="Firewatcher API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True, "home": {"lat": settings.home_lat, "lon": settings.home_lon, "label": settings.home_label}}


@app.get("/api/hotspots")
def hotspots(
    since_hours: int = Query(168, ge=1, le=240),
    max_distance_mi: float | None = Query(None, ge=0),
):
    """Return hotspots from the last `since_hours` hours, optionally limited by distance."""
    since = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()
    sql = (
        "SELECT id, source, latitude, longitude, acq_datetime, confidence, "
        "brightness, frp, daynight, distance_mi "
        "FROM hotspots WHERE acq_datetime >= ?"
    )
    params: list = [since]
    if max_distance_mi is not None:
        sql += " AND distance_mi <= ?"
        params.append(max_distance_mi)
    sql += " ORDER BY acq_datetime DESC"
    with conn() as c:
        rows = [dict(r) for r in c.execute(sql, params)]
    return {"count": len(rows), "hotspots": rows}


@app.get("/api/alerts")
def alerts():
    """Return active NWS fire-weather alerts."""
    now = datetime.now(timezone.utc).isoformat()
    with conn() as c:
        rows = [
            dict(r)
            for r in c.execute(
                "SELECT id, event, zones, headline, sent_at, onset, expires, severity "
                "FROM nws_alerts WHERE expires IS NULL OR expires > ? "
                "ORDER BY sent_at DESC",
                (now,),
            )
        ]
    return {"count": len(rows), "alerts": rows}


@app.get("/api/status")
def status():
    """Aggregate current status: alert count, recent hotspot count, latest hotspot time."""
    now = datetime.now(timezone.utc)
    h24 = (now - timedelta(hours=24)).isoformat()
    with conn() as c:
        h_recent = c.execute(
            "SELECT COUNT(*) AS n, MAX(acq_datetime) AS latest "
            "FROM hotspots WHERE acq_datetime >= ?",
            (h24,),
        ).fetchone()
        h_close = c.execute(
            "SELECT COUNT(*) AS n FROM hotspots "
            "WHERE acq_datetime >= ? AND distance_mi <= ?",
            (h24, settings.alert_radius_urgent),
        ).fetchone()
        a_active = c.execute(
            "SELECT COUNT(*) AS n FROM nws_alerts "
            "WHERE expires IS NULL OR expires > ?",
            (now.isoformat(),),
        ).fetchone()
    return {
        "home": {"lat": settings.home_lat, "lon": settings.home_lon, "label": settings.home_label},
        "radii": {
            "urgent": settings.alert_radius_urgent,
            "email": settings.alert_radius_email,
            "dashboard": settings.alert_radius_dashboard,
        },
        "hotspots_24h": h_recent["n"],
        "hotspots_24h_within_urgent": h_close["n"],
        "latest_hotspot_at": h_recent["latest"],
        "active_alerts": a_active["n"],
    }
