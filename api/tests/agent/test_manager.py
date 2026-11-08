import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from api.agent import manager as m
from api.state import state

T0 = datetime(2026, 11, 8, 2, 0, tzinfo=timezone.utc)


def mk(hid, **kw):
    h = {"id": hid, "language": "en", "medical_needs": [], "age_band": "40-64"}
    h.update(kw)
    return h


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(m, "SCRIPTED_SECONDS", 0.4)
    monkeypatch.setattr(m, "LIVE_HOMES", set())
    monkeypatch.setattr(m, "LIVE_ALL", False)        # these tests pick live homes explicitly
    monkeypatch.setattr(m, "SLOW_FOR_LIVE", True)    # and check the slow-down hooks still pair up
    saved = []
    toggles = []

    async def persist(*a):
        saved.append(a)

    async def live(active):
        toggles.append(active)

    monkeypatch.setattr(m, "_persist", persist)
    monkeypatch.setattr(m, "set_live_call", live)
    m._current = None
    m._active.clear()
    m._live_waiters.clear()
    state.run_id, state.sim_now = "r-test", T0
    state.homes_cache = []
    return {"saved": saved, "toggles": toggles}


async def settle(hid, timeout=5):
    for _ in range(int(timeout / 0.05)):
        if hid not in m._active:
            return
        await asyncio.sleep(0.05)
    raise AssertionError("call flow did not finish")


async def test_scripted_medical_call():
    state.homes_cache = [mk("H-05", medical_needs=["oxygen"])]
    await m.trigger_call("H-05", "warning")
    assert state.calls["H-05"]["call_status"] == "queued"
    await settle("H-05")
    assert state.calls["H-05"] == {"call_status": "done", "outcome": "medical"}
    v = m.current_view()
    assert v["phase"] == "done" and v["source"] == "scripted" and v["home_id"] == "H-05"
    assert all(isinstance(x, str) for x in v["transcript"])
    assert v["extracted"]["medical_issue"] == "oxygen" and v["extracted"]["has_heat"] is False
    assert "summary" not in v["extracted"] and "run_id" not in v
    types = [e["type"] for e in state.events]
    assert "call_started" in types and "call_result" in types


async def test_duplicate_trigger_ignored():
    state.homes_cache = [mk("H-04")]
    await m.trigger_call("H-04", "warning")
    await m.trigger_call("H-04", "warning")
    assert len([e for e in state.events if e["type"] == "call_started"]) <= 1
    await settle("H-04")
    assert len([e for e in state.events if e["type"] == "call_started"]) == 1


async def test_never_answers_becomes_unreachable_after_storm_minutes():
    state.homes_cache = [mk("H-35")]
    await m.trigger_call("H-35", "critical")
    for _ in range(100):
        if state.calls["H-35"]["call_status"] == "no_answer":
            break
        await asyncio.sleep(0.05)
    assert state.calls["H-35"]["call_status"] == "no_answer"
    await asyncio.sleep(0.8)
    assert state.calls["H-35"]["call_status"] == "no_answer"   # sim clock has not moved: no retry yet
    state.sim_now = T0 + timedelta(minutes=21)
    await settle("H-35")
    assert state.calls["H-35"] == {"call_status": "unreachable", "outcome": "unreachable"}


async def test_shy_home_answers_on_retry():
    state.homes_cache = [mk("H-18")]
    await m.trigger_call("H-18", "warning")
    for _ in range(100):
        if state.calls["H-18"]["call_status"] == "no_answer":
            break
        await asyncio.sleep(0.05)
    state.sim_now = T0 + timedelta(minutes=21)
    await settle("H-18")
    assert state.calls["H-18"]["call_status"] == "done"


async def test_live_call_via_webhook(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")
    for _ in range(50):
        if "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    assert state.calls["H-13"]["call_status"] == "ringing" and setup["toggles"] == [True]
    ok = await m.handle_live_transcript("H-13", ["SAVEL: Is your heat on?", "Resident: No heat and I need help."])
    assert ok
    await settle("H-13")
    assert setup["toggles"] == [True, False]
    assert state.calls["H-13"] == {"call_status": "done", "outcome": "needs_help"}
    assert m.current_view()["source"] == "live"


async def test_live_timeout_falls_back_to_scripted_when_enabled(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    monkeypatch.setattr(m, "LIVE_FALLBACK", "scripted")
    monkeypatch.setattr(m, "LIVE_WAIT_S", 0.1)
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")
    await settle("H-13")
    assert setup["toggles"] == [True, False]
    assert state.calls["H-13"]["call_status"] == "done"
    assert m.current_view()["source"] == "scripted"


async def test_answered_live_call_outlives_ring_timeout(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    monkeypatch.setattr(m, "LIVE_WAIT_S", 0.2)
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")
    for _ in range(50):
        if "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    assert m.mark_live_answered("H-13")
    assert m.current_view()["phase"] == "in_call"
    await asyncio.sleep(0.5)                     # past the ring timeout: still waiting, no fallback
    assert "H-13" in m._live_waiters
    assert await m.handle_live_transcript("H-13", ["SAVEL: Is your heat on?", "Resident: No heat, need help."])
    await settle("H-13")
    assert m.current_view()["source"] == "live" and state.calls["H-13"]["outcome"] == "needs_help"


async def test_live_silent_call_counts_as_no_answer(monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")
    for _ in range(50):
        if "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    await m.handle_live_transcript("H-13", ["SAVEL: Hello?"])
    await settle("H-13")
    assert state.calls["H-13"] == {"call_status": "unreachable", "outcome": "unreachable"}


async def test_declined_call_is_unreachable_with_no_script(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")
    for _ in range(50):
        if "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    assert m.mark_live_declined("H-13")
    await settle("H-13")
    assert state.calls["H-13"] == {"call_status": "unreachable", "outcome": "unreachable"}
    assert m.current_view()["source"] == "live"          # no scripted call took over
    assert any(e["type"] == "call_result" and "send help" in e["text"] for e in state.events)


async def test_unanswered_ring_is_unreachable(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    monkeypatch.setattr(m, "LIVE_WAIT_S", 0.1)
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")
    await settle("H-13")
    assert state.calls["H-13"]["outcome"] == "unreachable"


async def test_presenter_started_call_without_trigger():
    state.homes_cache = [mk("H-16")]
    assert await m.handle_live_transcript("H-16", ["SAVEL: Hi", "Resident: I'm fine, heat is on."])
    assert state.calls["H-16"] == {"call_status": "done", "outcome": "ok"}


async def test_reset_hides_call_and_aborts():
    state.homes_cache = [mk("H-06")]
    await m.trigger_call("H-06", "warning")
    state.run_id = "r-next"
    assert m.current_view() is None
    await settle("H-06")
    assert state.calls["H-06"]["call_status"] != "done"


async def test_home_details_fall_back_to_static_table(monkeypatch):
    from api import loop
    state.homes_cache = []          # the loop has not cached this home yet
    monkeypatch.setattr(loop, "_static", [{"id": "H-18", "language": "es", "age_band": "40-64", "medical_needs": "oxygen,heart"}])
    h = m._home("H-18")
    assert h["language"] == "es" and h["medical_needs"] == ["oxygen", "heart"]
    await m.trigger_call("H-18", "warning")
    for _ in range(100):
        v = m.current_view()
        if v and v["transcript"]:
            break
        await asyncio.sleep(0.05)
    assert m.current_view()["language"] == "es"
    state.run_id = "stop"           # abandon the shy retry wait
    await settle("H-18")


async def test_scripted_call_does_not_replace_active_live_view(monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    state.homes_cache = [mk("H-13"), mk("H-05", medical_needs=["oxygen"])]
    await m.trigger_call("H-13", "warning")
    for _ in range(50):
        if "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    await m.trigger_call("H-05", "warning")
    await settle("H-05")
    v = m.current_view()
    assert v["home_id"] == "H-13" and v["source"] == "live" and v["phase"] == "ringing"
    await m.handle_live_transcript("H-13", ["SAVEL: hi", "Resident: no heat, I need help"])
    await settle("H-13")
    assert m.current_view()["phase"] == "done"


async def test_stale_flow_from_previous_run_does_not_block_new_run(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_HOMES", {"H-13"})
    state.homes_cache = [mk("H-13")]
    await m.trigger_call("H-13", "warning")              # run r-test: live flow waits for a call
    for _ in range(50):
        if "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    state.run_id = "r-new"                                # reset: new run, old flow still waiting
    state.calls.clear()
    await m.trigger_call("H-13", "warning")              # must start a fresh flow
    assert m._active["H-13"] == "r-new"
    for _ in range(50):
        if state.calls.get("H-13", {}).get("call_status") == "ringing" and "H-13" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    assert state.calls["H-13"]["call_status"] == "ringing"
    assert setup["toggles"].count(True) == 2 and setup["toggles"].count(False) == 1   # old flow released its slot
    await m.handle_live_transcript("H-13", ["SAVEL: hi", "Resident: no heat, need help"])
    await settle("H-13")
    assert state.calls["H-13"]["outcome"] == "needs_help" and m.current_view()["source"] == "live"


async def test_calls_board_lists_every_call(setup):
    state.homes_cache = [mk("H-02"), mk("H-03")]
    await m.trigger_call("H-02", "warning")
    await m.trigger_call("H-03", "warning")
    await settle("H-02")
    await settle("H-03")
    board = m.all_views()
    assert {b["home_id"] for b in board} >= {"H-02", "H-03"}
    assert all(b["phase"] in ("done", "no_answer") for b in board if b["home_id"] in ("H-02", "H-03"))



async def test_every_home_rings_live_at_once(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_ALL", True)
    monkeypatch.setattr(m, "SLOW_FOR_LIVE", False)
    monkeypatch.setattr(m, "LIVE_WAIT_S", 0.4)
    state.homes_cache = [mk("H-31"), mk("H-32")]
    await m.trigger_call("H-31", "warning")
    await m.trigger_call("H-32", "warning")
    for _ in range(50):
        if {"H-31", "H-32"} <= set(m._live_waiters):
            break
        await asyncio.sleep(0.02)
    ringing = [b for b in m.all_views() if b["phase"] == "ringing"]
    assert {b["home_id"] for b in ringing} == {"H-31", "H-32"}
    assert all(b["ring_left_s"] is not None for b in ringing)
    assert m.mark_live_answered("H-31")                    # presenter picks H-31; H-32 keeps ringing
    await settle("H-32")
    assert state.calls["H-32"] == {"call_status": "unreachable", "outcome": "unreachable"}
    assert await m.handle_live_transcript("H-31", ["SAVEL: Is it cold?", "Resident: Yes, no heat, I need help."])
    await settle("H-31")
    assert state.calls["H-31"]["outcome"] == "needs_help"
    assert setup["toggles"] == []                            # ringing never slowed the storm


async def test_resolve_closes_the_call_card(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_ALL", True)
    state.homes_cache = [mk("H-33")]
    await m.trigger_call("H-33", "warning")
    for _ in range(50):
        if "H-33" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    m.mark_live_answered("H-33")
    m.resolve("H-33")
    card = next(b for b in m.all_views() if b["home_id"] == "H-33")
    assert card["phase"] == "done" and card["outcome"] == "helped"


async def test_help_keeps_what_the_call_found(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_ALL", True)
    monkeypatch.setattr(m, "LIVE_WAIT_S", 0.2)
    state.homes_cache = [mk("H-34")]
    await m.trigger_call("H-34", "warning")
    await settle("H-34")
    m.resolve("H-34")
    assert state.calls["H-34"] == {"call_status": "done", "outcome": "helped", "call_result": "unreachable"}
    card = next(b for b in m.all_views() if b["home_id"] == "H-34")
    assert card["result"] == "unreachable" and card["outcome"] == "helped"


async def test_browser_transcript_finishes_call_and_webhook_copy_is_ignored(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_ALL", True)
    state.homes_cache = [mk("H-35b")]
    await m.trigger_call("H-35b", "warning")
    for _ in range(50):
        if "H-35b" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    m.mark_live_answered("H-35b")
    assert m.mark_live_ended("H-35b")
    assert m.current_view()["phase"] == "extracting"
    lines = ["SAVEL: Is it cold?", "Resident: Yes, no heat, I need help."]
    assert await m.handle_live_transcript("H-35b", lines)          # browser copy
    await settle("H-35b")
    assert state.calls["H-35b"]["outcome"] == "needs_help"
    assert not await m.handle_live_transcript("H-35b", lines)      # webhook copy arrives later


async def test_browser_transcript_needs_an_open_live_call(setup):
    assert not m.live_call_open("H-05")


async def test_power_back_while_ringing_cancels_the_call(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_ALL", True)
    state.homes_cache = [mk("H-24")]
    await m.trigger_call("H-24", "warning")
    for _ in range(50):
        if "H-24" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    assert m.cancel_ringing("H-24")
    await settle("H-24")
    assert state.calls["H-24"] == {"call_status": "none", "outcome": "none"}
    card = next(b for b in m.all_views() if b["home_id"] == "H-24")
    assert card["phase"] == "done" and card["result"] is None


async def test_answered_call_is_not_cancelled(setup, monkeypatch):
    monkeypatch.setattr(m, "LIVE_ALL", True)
    state.homes_cache = [mk("H-25")]
    await m.trigger_call("H-25", "warning")
    for _ in range(50):
        if "H-25" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    m.mark_live_answered("H-25")
    assert not m.cancel_ringing("H-25")
    m.resolve("H-25")
