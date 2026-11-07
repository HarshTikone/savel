"""Call endpoints. The flow itself lives in api/agent/manager.py; the loop imports trigger_call from here."""
from fastapi import APIRouter, Response

from api.agent.manager import current_view, trigger_call  # noqa: F401  (trigger_call re-exported)

router = APIRouter()


@router.get("/api/calls/current")
async def calls_current():
    return current_view()


@router.post("/api/calls/webhook", status_code=204)
async def calls_webhook():
    return Response(status_code=204)   # real handler lands in Part 6
