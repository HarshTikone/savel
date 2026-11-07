"""Call manager: one background task per at-risk home. Scripted by default, one live browser call.

Rules: sim time only (never wall clock for data), one worker process, every state change
checks the run it started in. Retry after CALL_RETRY_STORM_MINUTES of storm time, then unreachable.
"""
import asyncio
import json
import logging
import os
from datetime import timedelta

from api.agent import profiles, scripts
from api.agent.extract import extract, map_outcome
from api.db import get_pool
from api.simctl import set_live_call
from api.state import state

log = logging.getLogger("api.agent.manager")

SCRIPTED_SECONDS = float(os.getenv("SCRIPTED_CALL_SECONDS", "8"))
LIVE_WAIT_S = float(os.getenv("LIVE_CALL_WAIT_S", "180"))
RETRY_STORM_MIN = float(os.getenv("CALL_RETRY_STORM_MINUTES", "20"))
LIVE_FALLBACK = os.getenv("LIVE_FALLBACK", "scripted")
LIVE_HOMES = {h.strip() for h in os.getenv("LIVE_HOMES", "H-13").split(",") if h.strip()}

_current: dict | None = None
last_extracted: dict[str, dict] = {}     # home_id -> {"run_id", "source", "extracted"}
_active: set[str] = set()
_live_waiters: dict[str, asyncio.Future] = {}
_tasks: set[asyncio.Task] = set()
_sem: asyncio.Semaphore | None = None
_sem_loop = None


def _scripted_slots() -> asyncio.Semaphore:
    """At most 3 scripted calls at once; created per event loop."""
    global _sem, _sem_loop
    loop = asyncio.get_running_loop()
    if _sem is None or _sem_loop is not loop:
        _sem, _sem_loop = asyncio.Semaphore(3), loop
    return _sem


# ---- helpers -------------------------------------------------------------------------------
def _stale(run_id: str) -> bool:
    return state.run_id != run_id


def _home(home_id: str) -> dict:
    return next((h for h in state.homes_cache if h["id"] == home_id),
                {"id": home_id, "language": "en", "medical_needs": [], "age_band": None})


def _set(home_id: str, call_status: str, outcome: str = "none") -> None:
    state.calls[home_id] = {"call_status": call_status, "outcome": outcome}


def _start_view(home: dict, run_id: str, source: str, phase: str) -> dict:
    global _current
    _current = {"run_id": run_id, "home_id": home["id"], "phase": phase, "source": source,
                "language": home.get("language") or "en", "transcript": [], "extracted": None}
    return _current


def current_view() -> dict | None:
    if not _current or _stale(_current["run_id"]):
        return None
    return {k: v for k, v in _current.items() if k != "run_id"}


def ui_extracted(e: dict | None) -> dict | None:
    """Only the four contract fields; nulls omitted; medical_issue as text (the panel prints it)."""
    if not e:
        return None
    out = {}
    for k in ("has_heat", "needs_help", "can_leave"):
        if isinstance(e.get(k), bool):
            out[k] = e[k]
    out["medical_issue"] = (e.get("medical_detail") or "medical concern") if e.get("medical_issue") else False
    return out


def _sev(outcome: str) -> str:
    return {"medical": "critical", "needs_help": "warning", "unreachable": "warning"}.get(outcome, "info")


async def _persist(run_id, home_id, started, status, source, transcript, extracted, outcome) -> None:
    try:
        pool = await get_pool()
        await pool.execute(
            "INSERT INTO calls (run_id, home_id, started_at, status, source, transcript, extracted, outcome) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
            run_id, home_id, started, status, source, "\n".join(transcript),
            json.dumps(extracted) if extracted is not None else None, outcome)
    except Exception:
        log.warning("could not persist call for %s", home_id, exc_info=True)


def _resident_spoke(lines: list[str]) -> bool:
    return any(ln.lower().startswith(("resident:", "user:")) and ln.split(":", 1)[1].strip() for ln in lines)


async def _finish(home: dict, run_id: str, source: str, lines: list[str], started, v: dict) -> None:
    """Extract, map, publish. Called once the transcript is complete."""
    hid = home["id"]
    if _stale(run_id):
        return
    v["phase"] = "extracting"
    extracted = await extract(lines)
    needs = home.get("medical_needs") or []
    extracted["medical_detail"] = ", ".join(needs) if needs else None
    if _stale(run_id):
        return
    outcome = map_outcome(extracted)
    last_extracted[hid] = {"run_id": run_id, "source": source, "extracted": extracted}
    _set(hid, "done", outcome)
    v["extracted"] = ui_extracted(extracted)
    v["phase"] = "done"
    state.add_event("call_result", hid, f"{hid}: {extracted.get('summary') or outcome} (outcome: {outcome})", _sev(outcome))
    await _persist(run_id, hid, started, "done", source, lines, extracted, outcome)


# ---- attempts ------------------------------------------------------------------------------
async def _scripted_attempt(home: dict, run_id: str, attempt: int, started) -> bool:
    hid = home["id"]
    async with _scripted_slots():
        if _stale(run_id):
            return True
        v = _start_view(home, run_id, "scripted", "ringing")
        _set(hid, "ringing")
        state.add_event("call_started", hid, f"Scripted check-in call to {hid}", "info")
        await asyncio.sleep(min(1.5, SCRIPTED_SECONDS / 4))
        if not profiles.answers_attempt(hid, attempt):
            await asyncio.sleep(min(2.0, SCRIPTED_SECONDS / 4))
            if _stale(run_id):
                return True
            _set(hid, "no_answer")
            v["phase"] = "no_answer"
            state.add_event("call_result", hid, f"{hid}: no answer (attempt {attempt})", "info")
            return False
        _set(hid, "in_call")
        v["phase"] = "in_call"
        lines = scripts.build_transcript(home)
        gap = max(0.2, (SCRIPTED_SECONDS * 0.75) / max(1, len(lines)))
        for ln in lines:
            if _stale(run_id):
                return True
            v["transcript"].append(ln)
            await asyncio.sleep(gap)
    await _finish(home, run_id, "scripted", lines, started, v)
    return True


async def _live_attempt(home: dict, run_id: str, started) -> bool | None:
    """True answered, False no answer, None = fell through to caller's fallback."""
    hid = home["id"]
    v = _start_view(home, run_id, "live", "ringing")
    v["transcript"].append("SAVEL: Live voice call is open in the browser. Waiting for the resident to pick up.")
    _set(hid, "ringing")
    state.add_event("call_started", hid, f"Live voice check-in call to {hid}", "info")
    fut = asyncio.get_running_loop().create_future()
    _live_waiters[hid] = fut
    await set_live_call(True)
    try:
        lines = await asyncio.wait_for(fut, LIVE_WAIT_S)
    except asyncio.TimeoutError:
        lines = None
    finally:
        _live_waiters.pop(hid, None)
        await set_live_call(False)
    if _stale(run_id):
        return True
    if lines is None:
        return None
    if not _resident_spoke(lines):
        _set(hid, "no_answer")
        v["phase"] = "no_answer"
        state.add_event("call_result", hid, f"{hid}: live call ended with no response", "info")
        return False
    v["transcript"][:] = lines
    _set(hid, "in_call")
    await _finish(home, run_id, "live", lines, started, v)
    return True


async def _wait_storm_minutes(minutes: float, since, run_id: str) -> bool:
    while not _stale(run_id):
        if state.sim_now and state.sim_now >= since + timedelta(minutes=minutes):
            return True
        await asyncio.sleep(0.5)
    return False


async def _run(home_id: str, reason: str, run_id: str) -> None:
    try:
        home = _home(home_id)
        first_sim = state.sim_now
        for attempt in (1, 2):
            if _stale(run_id):
                return
            started = state.sim_now
            answered = None
            if attempt == 1 and home_id in LIVE_HOMES:
                answered = await _live_attempt(home, run_id, started)
                if answered is None and LIVE_FALLBACK != "scripted":
                    _set(home_id, "no_answer")
                    answered = False
            if answered is None:
                answered = await _scripted_attempt(home, run_id, attempt, started)
            if answered:
                return
            if attempt == 1:
                if not await _wait_storm_minutes(RETRY_STORM_MIN, first_sim, run_id):
                    return
        if _stale(run_id):
            return
        _set(home_id, "unreachable", "unreachable")
        state.add_event("call_result", home_id, f"{home_id}: unreachable after two attempts", "warning")
        await _persist(run_id, home_id, first_sim, "unreachable", "scripted", [], None, "unreachable")
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("call flow failed for %s", home_id)
    finally:
        _active.discard(home_id)


async def trigger_call(home_id: str, reason: str) -> None:
    """Returns immediately; the call runs as a background task. At most one flow per home."""
    if home_id in _active or not state.run_id:
        return
    _active.add(home_id)
    _set(home_id, "queued")
    t = asyncio.create_task(_run(home_id, reason, state.run_id))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


async def handle_live_transcript(home_id: str, lines: list[str]) -> bool:
    """Called by the webhook with a finished browser-call transcript. Returns True if accepted."""
    fut = _live_waiters.get(home_id)
    if fut and not fut.done():
        fut.set_result(lines)
        return True
    if not state.run_id or home_id in _active:
        return False
    # Presenter started a call outside a trigger (e.g. the Call resident button): process it directly.
    run_id, home, started = state.run_id, _home(home_id), state.sim_now
    _active.add(home_id)
    try:
        v = _start_view(home, run_id, "live", "in_call")
        v["transcript"][:] = lines
        state.add_event("call_started", home_id, f"Live voice check-in call to {home_id}", "info")
        if not _resident_spoke(lines):
            _set(home_id, "no_answer")
            v["phase"] = "no_answer"
            return True
        _set(home_id, "in_call")
        await _finish(home, run_id, "live", lines, started, v)
    finally:
        _active.discard(home_id)
    return True
