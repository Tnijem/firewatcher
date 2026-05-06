"""AirNow current-observation poller.

API docs: https://docs.airnowapi.org/
Endpoint: /aq/observation/latLong/current/?latitude=...&longitude=...&distance=...&API_KEY=...
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


async def poll_all() -> int:
    log.info("AirNow poller stub")
    return 0
