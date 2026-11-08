import asyncio

from api.agent import manager as m
from api.predict import status
from api.risk import risk_score
from api.state import state


def test_recovering_until_comfortable():
    assert status(48.0, 0, True, None, "helped") == "recovering"
    assert status(61.9, 0, True, None, "none") == "recovering"
    assert status(63.0, 0, True, None, "helped") == "heated"
    assert status(48.0, 0, False, 0.5, "none") == "critical"
    assert status(48.0, 40, True, None, "helped") == "critical"   # CO still wins


def test_helped_home_drops_out_of_the_queue():
    home = {"temp_f": 45.0, "co_ppm": 0, "heating": True, "hours_to_50": None,
            "age_band": "75+", "medical_needs": ["oxygen"], "online": True}
    assert risk_score(home, {"call_status": "done", "outcome": "helped"}) == 0
    assert risk_score(home, {"call_status": "done", "outcome": "medical"}) > 0


async def test_resolve_cancels_a_live_call_and_marks_helped(monkeypatch):
    async def noop(_on):
        return None
    monkeypatch.setattr(m, "set_live_call", noop)
    state.run_id = "r-test"
    m.set_live_home("H-21")
    assert m.LIVE_HOMES == {"H-21"}
    await m.trigger_call("H-21", "warning")
    for _ in range(50):
        if "H-21" in m._live_waiters:
            break
        await asyncio.sleep(0.02)
    m.resolve("H-21")
    await asyncio.sleep(0.1)
    assert state.calls["H-21"] == {"call_status": "done", "outcome": "helped"}
    assert "H-21" not in m._active and "H-21" not in m._live_waiters
