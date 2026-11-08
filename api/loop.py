"""The 2-second brain: per-home state, countdowns, status, risk, call trigger, forecast log."""
import asyncio
import logging
import math
import os
import time
from datetime import timedelta

from api.calls import trigger_call
from api.db import get_pool
from api.predict import estimate, hours_to, median, status
from api.queries import HOMES_SQL, INSERT_PRED_SQL, fetch_k_fit, fetch_latest
from api.risk import risk_score
from api.simctl import SPEEDUP, sim_state
from api.state import state
from api.trends import WINDOW_SQL, classify

log = logging.getLogger("api.loop")
LOOP_SECONDS = float(os.getenv("LOOP_SECONDS", "2"))
OUTDOOR_F = float(os.getenv("OUTDOOR_F", "5"))
DEFAULT_K = 0.10
SETPOINT_F = 68.0
PRED_BUCKET_S = 600           # log forecasts every 10 simulated minutes
HORIZONS = (30, 60)

_static: list[dict] = []      # homes table, loaded once
_lock = asyncio.Lock()
_tasks: set[asyncio.Task] = set()
_cycles = 0


async def _static_homes(pool) -> list[dict]:
    global _static
    if not _static:
        _static = [dict(r) for r in await pool.fetch(HOMES_SQL)]
    return _static


def _spawn(coro) -> None:
    t = asyncio.create_task(coro)
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


def _power_events(blocks: list[dict]) -> None:
    for b in blocks:
        name, on = b["block"], bool(b["power_on"])
        prev = state.prev_power.get(name)
        if prev is None and on:
            state.prev_power[name] = on
            continue
        if prev != on:
            if on:
                state.add_event("power_restored", None, f"Power restored to Block {name}", "info")
            else:
                state.add_event("power_cut", None, f"Power cut to Block {name}", "warning")
            state.prev_power[name] = on


MEDIAN_N = 5                 # displayed temperature = median of the last 5 readings
TREND_N = 10                 # trend = robust line through the last 10 readings


async def _fetch_windows(pool, run_id, sim_now, ids):
    rows = await pool.fetch(WINDOW_SQL, run_id, ids, sim_now, TREND_N)
    out: dict[str, list[tuple[float, float]]] = {}
    for r in rows:
        out.setdefault(r["home_id"], []).append((float(r["t"]), float(r["temp_f"])))
    return out


async def compute_homes() -> None:
    async with _lock:
        await _compute()


async def _compute() -> None:
    if not state.run_id or not state.sim_now:
        return
    try:
        await sim_state()
    except Exception:
        pass  # keep the last cached simulator state
    run_id, sim_now = state.run_id, state.sim_now
    sim = state.sim_state or {}
    speed = int(sim.get("speed") or SPEEDUP)
    block_power = {b["block"]: bool(b["power_on"]) for b in sim.get("blocks", [])}
    houses_off = set(sim.get("houses_off", []))

    pool = await get_pool()
    homes = await _static_homes(pool)
    latest = await fetch_latest(pool, run_id)
    fits = await fetch_k_fit(pool, run_id, sim_now)
    windows = await _fetch_windows(pool, run_id, sim_now, [h["id"] for h in homes])
    if state.run_id != run_id:
        return  # a reset landed mid-cycle; the next cycle handles the new run
    positive = [k for k in fits.values() if k > 0]
    global_k = median(positive)
    offline_after = 3 * speed  # storm seconds: 3 missed ticks

    results, preds = [], []
    for h in homes:
        hid = h["id"]
        last = latest.get(hid)
        fitted = fits.get(hid)
        if fitted is not None:
            k_est, k_source = fitted, "learned"
        elif global_k is not None:
            k_est, k_source = global_k, "median"
        else:
            k_est, k_source = None, None
        k_calc = k_est if k_est is not None else DEFAULT_K
        trend = {"label": "falling", "slope_f_per_h": None}   # silent homes in the dark are assumed to cool

        if last is None:
            # Never reported in this run (no battery, block dark since the run began):
            # estimate from the setpoint at run start so silence raises concern.
            if state.run_started is None or (block_power.get(h["block"], True) and hid not in houses_off):
                continue
            out = float(sim.get("outdoor_f", OUTDOOR_F))
            silent_h = (sim_now - state.run_started).total_seconds() / 3600
            temp, co, power_on, heating, online = estimate(SETPOINT_F, out, max(k_calc, 0), silent_h), 0.0, False, False, False
        else:
            out = float(sim.get("outdoor_f", last["outdoor_f"]))
            temp, co = float(last["temp_f"]), float(last["co_ppm"])
            power_on, heating = bool(last["power_on"]), bool(last["heating"])
            silent_s = (sim_now - last["time"]).total_seconds()
            online = silent_s <= offline_after
            pts = windows.get(hid, [])
            if online and pts:
                temp = median([v for _, v in pts[-MEDIAN_N:]])   # one noisy reading or spike can't move it
            trend = classify(pts) if online and not heating else trend
            if not online:
                power_on = block_power.get(h["block"], power_on) and hid not in houses_off
                if not power_on:
                    heating = False  # the sensor went quiet and its block has no power: no heat either
                if not heating and k_calc > 0:
                    temp = estimate(temp, out, k_calc, silent_s / 3600)

        slope = trend.get("slope_f_per_h")
        declining = (not heating) and (trend.get("label") in ("declining", "slowing", "falling", "insufficient")
                                       or (slope is not None and slope <= -1.0))
        # Countdown from the robust trend when we have one (k = -slope / (T - outdoor)), else the fit.
        k_pred = None
        if declining and slope is not None and slope < 0 and temp - out > 1:
            k_pred = -slope / (temp - out)
        elif declining and k_est is not None:
            k_pred = k_calc
        h60 = h50 = None
        if k_pred:
            h60 = hours_to(temp, out, 60, k_pred)
            h50 = hours_to(temp, out, 50, k_pred)
        call = state.calls.get(hid)
        call_status = (call or {}).get("call_status", "none")
        outcome = (call or {}).get("outcome", "none")
        st = status(temp, co, heating, h50, outcome, declining)
        home = {
            "id": hid, "block": h["block"], "lat": h["lat"], "lon": h["lon"],
            "temp_f": round(temp, 2), "co_ppm": round(co, 2), "power_on": power_on, "heating": heating,
            "online": online, "k_est": None if k_est is None else round(k_est, 4), "k_source": k_source,
            "hours_to_60": None if h60 is None else round(h60, 2),
            "hours_to_50": None if h50 is None else round(h50, 2),
            "status": st, "risk": 0, "call_status": call_status, "outcome": outcome,
            "trend": "heating" if heating else ("falling" if declining else "holding"),
            "slope_f_per_h": None if slope is None or heating else round(slope, 2),
            "age_band": h["age_band"],
            "medical_needs": [m for m in (h["medical_needs"] or "").split(",") if m],
            "language": h["language"],
        }
        home["risk"] = int(risk_score(home, call))
        results.append(home)

        # Call trigger and episode reset (PRD, verbatim logic).
        should_call = (not heating and st in ("warning", "critical")) or co >= 35
        if should_call and hid not in state.episodes:
            state.episodes.add(hid)
            state.add_event("threshold", hid, f"{hid} reached {st}", st)
            _spawn(trigger_call(hid, reason=st))
        if heating and co < 35:
            state.episodes.discard(hid)

        # Forecasts to score later: cooling, unheated, online homes with their own fit.
        if last is not None and online and not heating and k_source == "learned" and fitted > 0 and global_k:
            for horizon in HORIZONS:
                for src, k in (("learned", fitted), ("global", global_k)):
                    preds.append((hid, horizon, src, estimate(temp, out, k, horizon / 60)))

    _power_events(sim.get("blocks", []))

    bucket = int(sim_now.timestamp() // PRED_BUCKET_S)
    if bucket != state.last_pred_bucket:
        state.last_pred_bucket = bucket
        if preds:
            await pool.execute(
                INSERT_PRED_SQL, [sim_now] * len(preds), [run_id] * len(preds), [p[0] for p in preds],
                [p[1] for p in preds], [p[2] for p in preds],
                [sim_now + timedelta(minutes=p[1]) for p in preds], [p[3] for p in preds])

    results.sort(key=lambda x: (-x["risk"], x["hours_to_50"] if x["hours_to_50"] is not None else math.inf, x["id"]))
    if state.run_id == run_id:
        state.homes_cache = results


async def run_loop() -> None:
    global _cycles
    while True:
        started = time.perf_counter()  # measures cycle duration only; never used as data time
        try:
            await compute_homes()
        except Exception:
            log.exception("loop cycle failed")
        took = time.perf_counter() - started
        _cycles += 1
        if _cycles % 15 == 1:
            log.info("loop cycle %d took %.0f ms (%d homes)", _cycles, took * 1000, len(state.homes_cache))
        await asyncio.sleep(max(0.0, LOOP_SECONDS - took))
