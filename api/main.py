"""SAVEL API. Run with ONE worker: uvicorn api.main:app --port 8000 (never --workers)."""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import calls, db, ingest, loop, routes, trends
from api.state import state

logging.basicConfig(level=logging.INFO, format="%(asctime)s api %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # no per-request noise from the sim poll
log = logging.getLogger("api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await db.get_pool()
    except Exception as e:  # keep serving; /api/health reports 503 until the DB is back
        log.warning("database not reachable at startup: %s", e)
    task = asyncio.create_task(loop.run_loop()) if os.getenv("LOOP_ENABLED", "1") == "1" else None
    yield
    if task:
        task.cancel()
    await db.close_pool()


app = FastAPI(title="SAVEL", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["*"], allow_headers=["*"],
)
app.include_router(ingest.router)
app.include_router(routes.router)
app.include_router(calls.router)
app.include_router(trends.router)


@app.get("/api/health")
async def health():
    body = {"ok": True, "sim_now": state.sim_now, "run_id": state.run_id, "rows_ingested": state.rows_ingested}
    try:
        pool = await db.get_pool()
        await pool.fetchval("SELECT 1", timeout=3)
    except Exception:
        body["ok"] = False
        return JSONResponse(status_code=503, content={**body, "sim_now": body["sim_now"] and body["sim_now"].isoformat()})
    return body
