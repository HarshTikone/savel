"""SAVEL API: contract stubs. Implement each endpoint behind the agreed shapes."""
from typing import Any

from fastapi import FastAPI

app = FastAPI(title="SAVEL")


@app.post("/api/ingest")
def ingest(readings: list[dict[str, Any]]):
    # [{time, home_id, temp_f, co_ppm, power_on}] -> write to readings hypertable
    return {"ingested": len(readings)}


@app.get("/api/homes")
def homes():
    # [{id, block, lat, lon, temp_f, co_ppm, power_on, online, k_est, hours_to_60,
    #   hours_to_50, risk, status, call_status, outcome, age_band, medical_needs, language}]
    return []


@app.get("/api/homes/{home_id}/series")
def series(home_id: str):
    return {"actual": [], "predicted": []}


@app.get("/api/events")
def events():
    # latest 20 log lines
    return []


@app.get("/api/calls/current")
def calls_current():
    return {"home_id": None, "phase": "idle", "transcript": [], "extracted": None}


@app.post("/api/calls/webhook")
def calls_webhook(payload: dict[str, Any]):
    # ElevenLabs post-call transcript -> Gemini extraction {has_heat, needs_help, medical_issue, can_leave}
    return {"ok": True}


@app.post("/api/sim/{action}/{arg}")
def sim_proxy(action: str, arg: str):
    # action in: cut_power | restore_power | block_vent | clear_vent | outdoor -> proxy to SIM_URL
    return {"action": action, "arg": arg}


@app.get("/api/accuracy")
def accuracy():
    # predicted vs actual error at 30 and 60 min ahead
    return {"mae_30": None, "mae_60": None}
