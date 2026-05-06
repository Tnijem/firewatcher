"""Georgia Forestry Commission burn ban / fire activity poller.

GFC publishes burn permit and burn ban status by county. The public-facing page is
https://gatrees.org/burn-permits-notifications/ — exact endpoint and parsing is TBD;
this stub is wired into the scheduler so it can be filled in without restructuring.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

WATCHED_COUNTIES = ["Lowndes", "Brooks", "Cook", "Lanier", "Echols", "Berrien"]


async def poll_all() -> int:
    log.info("GFC poller stub — wire up scraper next")
    return 0
