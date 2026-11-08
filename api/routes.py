"""Read endpoints and the simulator proxy."""
import logging
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from api import loop
from api.agent import manager
from api.db import get_pool
from api.predict import estimate, predict_curve
from api.queries import SERIES_SQL, fetch_accuracy
from api.simctl import SPEEDUP, sim_post, sim_state
from api.state import state

router = APIRouter()
log = logging.getLogger("api.routes")
OUTDOOR_F = float(os.getenv("OUTDOOR_F", "5"))
BLOCKS = {"A", "B", "C", "D"}
ACTIONS = {"cut_power", "restore_power", "block_vent", "clear_vent", "outdoor", "speed", "cut_house", "restore_house"}


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
        "focus_home": state.focus_home,
        "houses_off": list(sim.get("houses_off", [])),
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
    if action in ("block_vent", "clear_vent", "cut_house", "restore_house"):
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
    elif action == "cut_house":
        state.focus_home = arg
        manager.set_live_home(arg)        # the house in the story gets the live AI call
        state.add_event("house_power_cut", arg, f"Power cut at {arg}", "warning")
    elif action == "restore_house":
        state.add_event("house_power_restored", arg, f"Power restored at {arg}", "info")
    await _refresh()
    return res


@router.post("/api/homes/{home_id}/help")
async def help_delivered(home_id: str):
    """A responder reached the home: close its call, bring its power back, let it warm up."""
    home_id = _validate("cut_house", home_id)
    manager.resolve(home_id)
    for action in ("power_house", "clear_vent"):   # the responder restores heat (even in a dark block) and clears a blocked vent
        try:
            await sim_post(action, home_id)
        except HTTPException:
            log.warning("%s failed for %s", action, home_id)
    state.add_event("help_delivered", home_id, f"Help delivered at {home_id}; power restored", "info")
    await _refresh()
    return {"home_id": home_id, "outcome": "helped"}


@router.get("/api/events")
async def events():
    return list(reversed(state.events))[:30]


@router.get("/api/accuracy")
async def accuracy():
    pool = await get_pool()
    return await fetch_accuracy(pool, state.run_id, state.sim_now)


@router.get("/api/homes/{home_id}/series")
async def series(home_id: str):
    pool = await get_pool()
    if home_id not in {h["id"] for h in await loop._static_homes(pool)}:
        raise HTTPException(404, f"unknown home {home_id}")
    run_id, sim_now = state.run_id, state.sim_now
    if not run_id or not sim_now:
        return {"actual": [], "predicted": []}
    rows = await pool.fetch(SERIES_SQL, run_id, home_id, sim_now)
    actual = [{"t": r["time"], "temp_f": round(r["temp_f"], 2), "est": False} for r in rows]
    cur = next((h for h in state.homes_cache if h["id"] == home_id), None)
    if cur is None:
        return {"actual": actual, "predicted": []}
    out = float((state.sim_state or {}).get("outdoor_f", OUTDOOR_F))
    k = cur["k_est"] if cur["k_est"] is not None else loop.DEFAULT_K
    if not cur["online"] and not cur["heating"] and rows:
        last_t, last_temp = rows[-1]["time"], rows[-1]["temp_f"]
        t = last_t + timedelta(minutes=15)
        while t <= sim_now:
            hrs = (t - last_t).total_seconds() / 3600
            temp = estimate(last_temp, out, k, hrs) if k > 0 else last_temp
            actual.append({"t": t, "temp_f": round(temp, 2), "est": True})
            t += timedelta(minutes=15)
    predicted = [{"t": sim_now + timedelta(minutes=m), "temp_f": round(temp, 2), "est": False}
                 for m, temp in predict_curve(cur["temp_f"], out, k, cur["heating"])]
    return {"actual": actual, "predicted": predicted}
