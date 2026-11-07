"""STUB owned by Harsh: he replaces this file keeping `async trigger_call(home_id, reason)`,
GET /api/calls/current and POST /api/calls/webhook."""
from fastapi import APIRouter, Response

from api.state import state

router = APIRouter()


async def trigger_call(home_id: str, reason: str) -> None:
    """Returns immediately. The stub marks a scripted call as done with no outcome."""
    state.add_event("call_started", home_id, f"Scripted check-in call to {home_id} ({reason})", "info")
    state.calls[home_id] = {"call_status": "done", "outcome": "none"}
    state.add_event("call_result", home_id, f"{home_id}: scripted stub, no outcome", "info")


@router.get("/api/calls/current")
async def calls_current():
    return None


@router.post("/api/calls/webhook", status_code=204)
async def calls_webhook():
    return Response(status_code=204)
