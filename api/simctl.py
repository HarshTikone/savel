"""Talks to the simulator (internal network only)."""
import logging
import os

import httpx
from fastapi import HTTPException

from api.state import state

SIM_URL = os.getenv("SIM_URL", "http://localhost:8001").rstrip("/")
SPEEDUP = int(os.getenv("SPEEDUP", "300"))
LIVE_CALL_SPEEDUP = int(os.getenv("LIVE_CALL_SPEEDUP", "30"))
log = logging.getLogger("api.simctl")


async def sim_post(action: str, arg=None, params: dict | None = None) -> dict:
    url = f"{SIM_URL}/{action}" + (f"/{arg}" if arg is not None else "")
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(url, params=params)
    except httpx.HTTPError:
        raise HTTPException(502, "simulator unavailable")
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", r.text)
        except ValueError:
            detail = r.text
        raise HTTPException(400, str(detail))
    return r.json()


async def sim_state() -> dict:
    """GET the simulator's /state and cache it in state.sim_state."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get(f"{SIM_URL}/state")
            r.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(502, "simulator unavailable")
    state.sim_state = r.json()
    return state.sim_state


async def set_live_call(active: bool) -> None:
    """Harsh's call flow calls this around LIVE calls. Counted, so overlapping calls are safe:
    first start saves the current speed and drops to LIVE_CALL_SPEEDUP; last end restores it."""
    try:
        if active:
            state.live_calls += 1
            if state.live_calls == 1:
                state.saved_speed = int((state.sim_state or {}).get("speed") or SPEEDUP)
                await sim_post("speed", LIVE_CALL_SPEEDUP)
        else:
            if state.live_calls == 0:
                return
            state.live_calls -= 1
            if state.live_calls == 0:
                restore, state.saved_speed = state.saved_speed or SPEEDUP, None
                await sim_post("speed", restore)
    except HTTPException as e:
        log.warning("set_live_call(%s) could not reach simulator: %s", active, e.detail)
