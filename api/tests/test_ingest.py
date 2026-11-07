from datetime import datetime, timezone

from api.state import state
from api.tests.conftest import T0, reading


def batch(run_id, t=T0, n=40):
    return [reading(f"H-{i:02d}", t, 66.0, run_id, heating=True, power_on=True) for i in range(1, n + 1)]


async def test_ingest_batch(client, run_id, pool):
    before = (await client.get("/api/health")).json()["rows_ingested"]
    r = await client.post("/api/ingest", json=batch(run_id))
    assert r.status_code == 200 and r.json() == {"inserted": 40}
    health = (await client.get("/api/health")).json()
    assert health["ok"] is True
    assert health["rows_ingested"] == before + 40
    assert health["run_id"] == run_id
    assert health["sim_now"].startswith("2026-11-08T02:00:00")
    assert await pool.fetchval("SELECT count(*) FROM readings WHERE run_id = $1", run_id) == 40


async def test_ingest_wrapped_body(client, run_id):
    r = await client.post("/api/ingest", json={"readings": batch(run_id, n=3)})
    assert r.status_code == 200 and r.json() == {"inserted": 3}


async def test_real_sensor_restamp(client, run_id, pool):
    await client.post("/api/ingest", json=batch(run_id, n=2))
    wall = datetime(2031, 1, 1, 12, 0, tzinfo=timezone.utc)
    real = reading("H-REAL", wall, 70.5, None, heating=True, power_on=True)
    real.pop("run_id")
    r = await client.post("/api/ingest", json=[real])
    assert r.json() == {"inserted": 1}
    row = await pool.fetchrow("SELECT time, run_id FROM readings WHERE home_id = 'H-REAL' AND run_id = $1", run_id)
    assert row["time"] == T0 == state.sim_now
    assert row["run_id"] == run_id


async def test_real_sensor_skipped_before_sim_now(client):
    real = reading("H-REAL", T0, 70.5, None, heating=True, power_on=True)
    assert (await client.post("/api/ingest", json=[real])).json() == {"inserted": 0}


async def test_new_run_resets_state(client, run_id):
    await client.post("/api/ingest", json=batch(run_id, n=2))
    state.episodes.add("H-01")
    state.add_event("threshold", "H-01", "x", "warning")
    new_run = run_id + "-b"
    await client.post("/api/ingest", json=batch(new_run, n=2))
    assert state.run_id == new_run
    assert state.episodes == set()
    assert [e["type"] for e in state.events] == ["reset"]


async def test_bad_body_422(client):
    r = await client.post("/api/ingest", json=[{"home_id": "H-01", "temp_f": "warm"}])
    assert r.status_code == 422
    assert "detail" in r.json()
