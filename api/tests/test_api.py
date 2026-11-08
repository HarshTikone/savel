import asyncio
from datetime import timedelta

import pytest

from api import loop
from api.queries import INSERT_PRED_SQL
from api.state import state
from api.tests.conftest import T0, insert_readings, reading


@pytest.fixture(autouse=True)
def no_sim(monkeypatch):
    async def fake_sim_state():
        return state.sim_state
    monkeypatch.setattr(loop, "sim_state", fake_sim_state)
    state.sim_state = {"run_id": "x", "speed": 300, "outdoor_f": 5.0,
                       "blocks": [{"block": b, "power_on": True} for b in "ABCD"]}


def batch(run_id, t, temp, heating):
    return [reading(f"H-{i:02d}", t, temp, run_id, heating=heating, power_on=heating) for i in range(1, 41)]


async def test_reset_isolation(client, pool, run_id):
    run_a, run_b = run_id + "-a", run_id + "-b"
    for i in range(3):
        await client.post("/api/ingest", json=batch(run_a, T0 + timedelta(minutes=5 * i), 57.0 - i, False))
    await loop.compute_homes()
    await asyncio.sleep(0)
    assert len(state.episodes) == 40 and len(state.events) == 41  # reset + 40 thresholds (deque keeps 60)
    await pool.execute(INSERT_PRED_SQL, [T0], [run_a], ["H-01"], [30], ["learned"],
                       [T0 + timedelta(minutes=5)], [50.0])
    assert (await client.get("/api/accuracy")).json()[0]["n"] == 1  # run A has a scored forecast

    state.sim_state = {**state.sim_state, "run_id": run_b}
    await client.post("/api/ingest", json=batch(run_b, T0, 66.5, True))  # same simulated time as run A
    await loop.compute_homes()

    homes = (await client.get("/api/homes")).json()
    assert len(homes) == 40 and all(h["temp_f"] == 66.5 and h["status"] == "heated" for h in homes)
    events = (await client.get("/api/events")).json()
    assert [e["type"] for e in events] == ["reset"] and run_b in events[0]["text"]
    acc = (await client.get("/api/accuracy")).json()
    assert len(acc) == 4 and all(r["n"] == 0 and r["mae_f"] is None for r in acc)


async def test_errors(client):
    r = await client.get("/api/homes/H-99/series")
    assert r.status_code == 404 and r.json() == {"detail": "unknown home H-99"}
    r = await client.post("/api/sim/foo/1")
    assert r.status_code == 400 and r.json() == {"detail": "unknown action foo"}
    r = await client.post("/api/sim/speed/99999")
    assert r.status_code == 400
    r = await client.post("/api/ingest", json={"nope": 1})
    assert r.status_code == 422


async def test_series_shape(client, pool, run_id):
    rows = [{"time": T0 + timedelta(minutes=5 * i), "run_id": run_id, "home_id": "H-01",
             "temp_f": 64.0 - i, "heating": False} for i in range(5)]
    rows += [{"time": T0, "run_id": run_id, "home_id": "H-02", "temp_f": 64.0, "heating": False}]
    await insert_readings(pool, rows)
    state.run_id, state.sim_now = run_id, T0 + timedelta(minutes=20)
    await loop.compute_homes()

    s = (await client.get("/api/homes/H-01/series")).json()
    ts = [p["t"] for p in s["actual"]]
    assert len(s["actual"]) == 5 and ts == sorted(ts) and not any(p["est"] for p in s["actual"])
    assert len(s["predicted"]) == 25
    assert s["predicted"][0]["t"].startswith("2026-11-08T02:20:00")
    assert s["predicted"][-1]["t"].startswith("2026-11-08T08:20:00")

    off = (await client.get("/api/homes/H-02/series")).json()  # silent for 20 storm minutes
    assert [p["est"] for p in off["actual"]] == [False, True]


async def test_accuracy_always_four_rows(client):
    acc = (await client.get("/api/accuracy")).json()
    assert [(r["horizon_min"], r["k_source"]) for r in acc] == [(30, "learned"), (30, "global"), (60, "learned"), (60, "global")]
    assert all(r["n"] == 0 and r["mae_f"] is None for r in acc)
