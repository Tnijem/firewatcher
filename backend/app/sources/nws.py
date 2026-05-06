"""NWS active alerts poller.

API docs: https://www.weather.gov/documentation/services-web-api
Active alerts for fire weather zones come from /alerts/active?zone=...
"""
from __future__ import annotations

import json
import logging

import httpx

from ..config import settings
from ..db import conn

log = logging.getLogger(__name__)

UA = "firewatcher (https://github.com/Tnijem/firewatcher)"
INTERESTING_EVENTS = {"Red Flag Warning", "Fire Weather Watch", "Extreme Fire Danger"}


async def poll_all() -> int:
    """Fetch active alerts for configured zones; upsert into nws_alerts."""
    n = 0
    async with httpx.AsyncClient(headers={"User-Agent": UA, "Accept": "application/geo+json"}) as client:
        for zone in settings.zone_list:
            try:
                r = await client.get(
                    f"https://api.weather.gov/alerts/active",
                    params={"zone": zone},
                    timeout=20,
                )
                r.raise_for_status()
                features = r.json().get("features", [])
            except Exception as e:
                log.exception("NWS zone %s failed: %s", zone, e)
                continue
            n += _store_alerts(features)
    return n


def _store_alerts(features: list[dict]) -> int:
    if not features:
        return 0
    with conn() as c:
        cur = c.cursor()
        n = 0
        for f in features:
            p = f.get("properties", {})
            event = p.get("event", "")
            if event not in INTERESTING_EVENTS:
                continue
            cur.execute(
                """INSERT OR REPLACE INTO nws_alerts
                   (id, event, zones, headline, description, sent_at, onset, expires, severity, raw_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    p.get("id") or f.get("id"),
                    event,
                    ",".join(p.get("affectedZones", [])),
                    p.get("headline"),
                    p.get("description"),
                    p.get("sent"),
                    p.get("onset"),
                    p.get("expires"),
                    p.get("severity"),
                    json.dumps(f),
                ),
            )
            n += 1
    return n
