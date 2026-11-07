"""POST /api/ingest: one INSERT per batch; tracks sim_now; restamps H-REAL."""
from fastapi import APIRouter, Body
from pydantic import BaseModel

from api.db import get_pool
from api.models import Reading
from api.state import state

router = APIRouter()
REAL_ID = "H-REAL"

INSERT_SQL = """
INSERT INTO readings (time, run_id, home_id, temp_f, co_ppm, power_on, heating, outdoor_f)
SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::float8[],
                     $5::float8[], $6::bool[], $7::bool[], $8::float8[])
"""


class Wrapped(BaseModel):
    readings: list[Reading]


@router.post("/api/ingest")
async def ingest(body: list[Reading] | Wrapped = Body(...)):
    readings = body.readings if isinstance(body, Wrapped) else body
    sim_rows = [r for r in readings if r.home_id != REAL_ID]

    batch_run = next((r.run_id for r in sim_rows if r.run_id), None)
    if batch_run and batch_run != state.run_id:
        state.reset(batch_run, at=min(r.time for r in sim_rows))

    rows = []
    for r in readings:
        if r.home_id == REAL_ID:
            if state.sim_now is None or state.run_id is None:
                continue  # nothing to stamp it with yet
            r = r.model_copy(update={"time": state.sim_now, "run_id": state.run_id})
        elif r.run_id is None:
            if state.run_id is None:
                continue
            r = r.model_copy(update={"run_id": state.run_id})
        rows.append(r)
    if not rows:
        return {"inserted": 0}

    pool = await get_pool()
    await pool.execute(
        INSERT_SQL,
        [r.time for r in rows], [r.run_id for r in rows], [r.home_id for r in rows],
        [r.temp_f for r in rows], [r.co_ppm for r in rows], [r.power_on for r in rows],
        [r.heating for r in rows], [r.outdoor_f for r in rows],
    )
    newest = max(r.time for r in rows)
    if state.sim_now is None or newest > state.sim_now:
        state.sim_now = newest
    state.rows_ingested += len(rows)
    return {"inserted": len(rows)}
