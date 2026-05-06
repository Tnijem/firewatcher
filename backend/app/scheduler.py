"""APScheduler glue. Each source has a poll_all() coroutine; jobs run on intervals."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .sources import airnow, drought, firms, gfc, nws

log = logging.getLogger(__name__)


def build_scheduler() -> AsyncIOScheduler:
    s = AsyncIOScheduler(timezone="UTC")

    # Hotspot detections — frequent.
    s.add_job(_safe(firms.poll_all), "interval", minutes=30, id="firms", next_run_time=None)
    # Red Flag / fire weather — every 15 min.
    s.add_job(_safe(nws.poll_all), "interval", minutes=15, id="nws", next_run_time=None)
    # Burn bans + fire activity — hourly.
    s.add_job(_safe(gfc.poll_all), "interval", hours=1, id="gfc", next_run_time=None)
    # Drought class — once per day (data only updates Thursdays).
    s.add_job(_safe(drought.poll_all), "interval", hours=24, id="drought", next_run_time=None)
    # Air quality — hourly.
    s.add_job(_safe(airnow.poll_all), "interval", hours=1, id="airnow", next_run_time=None)

    return s


def _safe(coro_fn):
    """Wrap a poll_all coroutine so one failure doesn't kill the scheduler."""
    async def wrapped():
        try:
            n = await coro_fn()
            log.info("%s -> %s new", coro_fn.__module__, n)
        except Exception:
            log.exception("%s failed", coro_fn.__module__)
    return wrapped
