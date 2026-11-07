import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ["LOOP_ENABLED"] = "0"

import asyncpg
import httpx
import pytest

from api import db
from api.seed_homes import seed
from api.state import state

SCHEMA = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
T0 = datetime(2026, 11, 8, 2, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="session", autouse=True)
def database():
    async def setup():
        conn = await asyncpg.connect(db.DATABASE_URL)
        try:
            await conn.execute(SCHEMA)
            await seed(conn)
        finally:
            await conn.close()
    asyncio.run(setup())


@pytest.fixture(autouse=True)
async def fresh_state():
    state.__init__()
    yield
    state.__init__()
    await db.close_pool()  # the pool is bound to this test's event loop


@pytest.fixture
def run_id():
    return f"r-test-{uuid.uuid4().hex[:10]}"


@pytest.fixture
async def client():
    from api.main import app
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def pool():
    return await db.get_pool()


def reading(home_id, t, temp_f, run_id, heating=False, power_on=False, co_ppm=0.0, outdoor_f=5.0):
    return {"time": t.isoformat(), "home_id": home_id, "temp_f": temp_f, "co_ppm": co_ppm,
            "power_on": power_on, "heating": heating, "outdoor_f": outdoor_f, "run_id": run_id}


async def insert_readings(pool, rows):
    """Insert reading dicts (time as datetime) directly, bypassing the API."""
    await pool.executemany(
        "INSERT INTO readings (time, run_id, home_id, temp_f, co_ppm, power_on, heating, outdoor_f) "
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [(r["time"], r["run_id"], r["home_id"], r["temp_f"], r.get("co_ppm", 0.0), r.get("power_on", False),
          r.get("heating", False), r.get("outdoor_f", 5.0)) for r in rows])


__all__ = ["T0", "reading", "insert_readings", "timedelta"]
