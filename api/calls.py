"""Call endpoints. The flow itself lives in api/agent/manager.py; the loop imports trigger_call from here."""
import asyncio
import json
import logging
import os

from fastapi import APIRouter, HTTPException, Request, Response

from api.agent import briefing, elevenlabs

from api.agent import manager
from api.agent.manager import current_view, trigger_call  # noqa: F401  (trigger_call re-exported)

router = APIRouter()
router.include_router(briefing.router)
log = logging.getLogger("api.calls")
_bg: set[asyncio.Task] = set()


@router.get("/api/calls/current")
async def calls_current():
    return current_view()


@router.post("/api/calls/webhook", status_code=204)
async def calls_webhook(request: Request):
    raw = await request.body()
    unsigned_ok = os.getenv("ALLOW_UNSIGNED_WEBHOOK") == "1"   # local testing only
    if not unsigned_ok and not elevenlabs.verify_signature(raw, request.headers.get("elevenlabs-signature")):
        raise HTTPException(401, "bad signature")
    try:
        parsed = elevenlabs.parse_post_call(json.loads(raw or b"{}"))
    except ValueError:
        raise HTTPException(400, "invalid json")
    if parsed is None:
        return Response(status_code=204)          # audio or failure events: nothing to do
    home_id, lines = parsed
    if not home_id:
        log.warning("webhook without home_id dynamic variable; ignored")
        return Response(status_code=204)
    t = asyncio.create_task(manager.handle_live_transcript(home_id, lines))   # extraction can take seconds
    _bg.add(t)
    t.add_done_callback(_bg.discard)
    return Response(status_code=204)
