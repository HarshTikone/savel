"""Read endpoints and the simulator proxy."""
import logging
import os
from datetime import datetime

from fastapi import APIRouter, HTTPException

from api import loop
from api.simctl import SPEEDUP, sim_post, sim_state
from api.state import state

router = APIRouter()
log = logging.getLogger("api.routes")
OUTDOOR_F = float(os.getenv("OUTDOOR_F", "5"))
BLOCKS = {"A", "B", "C", "D"}
ACTIONS = {"cut_power", "restore_power", "block_vent", "clear_vent", "outdoor", "speed"}


async def _refresh() -> None:
    try:
        await sim_state()
    except HTTPException:
        pass
    try:
        await loop.compute_homes()
    except Exception:
        log.exception("compute_homes after sim action failed")


@router.get("/api/homes")
async def homes():
    return state.homes_cache


@router.get("/api/state")
async def sim_state_route():
    sim = state.sim_state
    if sim is None:
        try:
            sim = await sim_state()
        except HTTPException:
            sim = {}
    return {
        "run_id": state.run_id or sim.get("run_id") or "",
        "sim_now": state.sim_now,
        "outdoor_f": float(sim.get("outdoor_f", OUTDOOR_F)),
        "speed": int(sim.get("speed", SPEEDUP)),
        "live_call": state.live_calls > 0,
        "blocks": [{"block": b["block"], "power_on": bool(b["power_on"])} for b in sim.get("blocks", [])],
    }


@router.post("/api/sim/reset")
async def sim_reset(prewarm: int | None = None):
    res = await sim_post("reset", params=None if prewarm is None else {"prewarm": prewarm})
    if state.run_id != res["run_id"]:
        at = datetime.fromisoformat(res["sim_now"].replace("Z", "+00:00"))
        if prewarm is None or prewarm > 0:
            at = None  # pre-warm batches normally switch the run first; keep their start time
        state.reset(res["run_id"], at=at)
    await _refresh()
    return res


def _validate(action: str, arg: str) -> str:
    if action not in ACTIONS:
        raise HTTPException(400, f"unknown action {action}")
    bad = HTTPException(400, f"bad argument {arg} for {action}")
    if action in ("cut_power", "restore_power"):
        if arg.upper() not in BLOCKS:
            raise bad
        return arg.upper()
    if action in ("block_vent", "clear_vent"):
        if not (len(arg) == 4 and arg.startswith("H-") and arg[2:].isdigit() and 1 <= int(arg[2:]) <= 40):
            raise bad
        return arg
    if action == "outdoor":
        try:
            v = float(arg)
        except ValueError:
            raise bad
        if not -30 <= v <= 60:
            raise bad
        return arg
    try:
        v = int(arg)
    except ValueError:
        raise bad
    if not 1 <= v <= 3600:
        raise bad
    return arg


@router.post("/api/sim/{action}/{arg}")
async def sim_action(action: str, arg: str):
    arg = _validate(action, arg)
    res = await sim_post(action, arg)
    if action == "cut_power":
        state.add_event("power_cut", None, f"Power cut to Block {arg}", "warning")
        state.prev_power[arg] = False
    elif action == "restore_power":
        state.add_event("power_restored", None, f"Power restored to Block {arg}", "info")
        state.prev_power[arg] = True
    elif action == "block_vent":
        state.add_event("vent_blocked", arg, f"Furnace vent blocked at {arg}", "warning")
    elif action == "clear_vent":
        state.add_event("vent_cleared", arg, f"Furnace vent cleared at {arg}", "info")
    await _refresh()
    return res
