import asyncio
from datetime import timedelta

import pytest

from api import loop, simctl
from api.state import state
from api.tests.conftest import T0, insert_readings

BLOCKS_ON = [{"block": b, "power_on": True} for b in "ABCD"]


@pytest.fixture
def calls(monkeypatch):
    made = []

    async def fake_trigger(home_id, reason):
        made.append((home_id, reason))

    async def fake_sim_state():
        return state.sim_state

    monkeypatch.setattr(loop, "trigger_call", fake_trigger)
    monkeypatch.setattr(loop, "sim_state", fake_sim_state)
    state.sim_state = {"run_id": "x", "speed": 300, "outdoor_f": 5.0, "blocks": BLOCKS_ON}
    return made


def row(run_id, home_id, t, temp, heating=False, power_on=False, co=0.0):
    return {"time": t, "run_id": run_id, "home_id": home_id, "temp_f": temp, "heating": heating,
            "power_on": power_on, "co_ppm": co, "outdoor_f": 5.0}


async def cycles(n):
    for _ in range(n):
        await loop.compute_homes()
        await asyncio.sleep(0)  # let spawned trigger tasks run


def home(home_id):
    return next(h for h in state.homes_cache if h["id"] == home_id)


async def test_trigger_once(pool, run_id, calls):
    await insert_readings(pool, [row(run_id, "H-11", T0, 58.0)])
    state.run_id, state.sim_now = run_id, T0
    await cycles(3)
    assert home("H-11")["status"] == "warning"
    assert [c for c in calls if c[0] == "H-11"] == [("H-11", "warning")]
    assert any(e["type"] == "threshold" and e["home_id"] == "H-11" for e in state.events)


async def test_no_repeat_call(pool, run_id, calls):
    await insert_readings(pool, [row(run_id, "H-12", T0, 54.0)])
    state.run_id, state.sim_now = run_id, T0
    await cycles(1)
    assert "H-12" in state.episodes
    t1 = T0 + timedelta(minutes=5)
    await insert_readings(pool, [row(run_id, "H-12", t1, 55.0, heating=True, power_on=True)])
    state.sim_now = t1
    await cycles(3)
    assert home("H-12")["status"] == "recovering" and home("H-12")["heating"] is True
    assert [c[0] for c in calls if c[0] == "H-12"] == ["H-12"]
    assert "H-12" not in state.episodes


async def test_co_trigger(pool, run_id, calls):
    await insert_readings(pool, [row(run_id, "H-27", T0, 66.0, heating=False, power_on=True, co=40.0)])
    state.run_id, state.sim_now = run_id, T0
    await cycles(3)
    assert home("H-27")["status"] == "critical"
    assert [c for c in calls if c[0] == "H-27"] == [("H-27", "critical")]


async def test_live_call_counter(monkeypatch):
    posts = []

    async def fake_post(action, arg=None, params=None):
        posts.append((action, arg))
        return {}

    monkeypatch.setattr(simctl, "sim_post", fake_post)
    monkeypatch.setattr(simctl, "LIVE_CALL_SPEEDUP", 30)   # the counter logic, independent of the default
    state.sim_state = {"speed": 120}
    await simctl.set_live_call(True)
    await simctl.set_live_call(True)
    assert posts == [("speed", 30)] and state.live_calls == 2
    await simctl.set_live_call(False)
    assert posts == [("speed", 30)] and state.live_calls == 1
    await simctl.set_live_call(False)
    assert posts == [("speed", 30), ("speed", 120)] and state.live_calls == 0
    await simctl.set_live_call(False)  # extra end is a no-op
    assert state.live_calls == 0 and len(posts) == 2


async def test_offline_threshold(pool, run_id, calls):
    await insert_readings(pool, [row(run_id, "H-14", T0, 62.0), row(run_id, "H-15", T0, 62.0)])
    state.run_id = run_id
    state.sim_now = T0 + timedelta(minutes=10)
    await cycles(1)
    assert home("H-14")["online"] is True and home("H-14")["temp_f"] == 62.0
    state.sim_now = T0 + timedelta(minutes=20)
    await cycles(1)
    h = home("H-14")
    assert h["online"] is False
    assert h["temp_f"] < 62.0  # estimate: 5 + 57·e^(-0.10·1/3) with the default k
    assert round(h["temp_f"], 2) == round(5 + 57 * 2.718281828 ** (-0.10 / 3), 2)
