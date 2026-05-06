"""US Drought Monitor poller — county-level intensity for Lowndes.

Public API: https://usdmdataservices.unl.edu/api
Stub for now; the full ComprehensiveStatistics endpoint returns the dominant
drought class (None / D0 / D1 / D2 / D3 / D4) per county per week.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


async def poll_all() -> int:
    log.info("Drought Monitor poller stub")
    return 0
