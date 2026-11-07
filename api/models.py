"""API contract (PRD v4). Field names, types and enum values are fixed: never rename."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Status = Literal["heated", "cooling", "warning", "critical", "leaving"]
CallStatus = Literal["none", "queued", "ringing", "in_call", "done", "no_answer", "unreachable"]
Outcome = Literal["none", "ok", "needs_help", "medical", "leaving", "unreachable"]
Phase = Literal["ringing", "in_call", "extracting", "done", "no_answer"]
Severity = Literal["info", "warning", "critical"]


class Reading(BaseModel):            # POST /api/ingest body item
    time: datetime                   # simulated time, UTC
    home_id: str
    temp_f: float                    # indoor °F
    co_ppm: float = 0.0
    power_on: bool
    heating: bool                    # furnace actually heating
    outdoor_f: float                 # outdoor °F at this reading
    run_id: str | None = None        # None only for H-REAL; backend fills it


class Home(BaseModel):               # GET /api/homes item
    id: str
    block: str
    lat: float
    lon: float
    temp_f: float                    # latest reading, or estimate when offline
    co_ppm: float
    power_on: bool
    heating: bool
    online: bool                     # a reading within 5 storm minutes
    k_est: float | None              # per storm hour; None before any fit exists
    k_source: Literal["learned", "median"] | None
    hours_to_60: float | None        # storm hours; None when heating or not cooling
    hours_to_50: float | None        # storm hours; None when heating or not cooling
    status: Status
    risk: int                        # 0-100, from risk_score()
    call_status: CallStatus
    outcome: Outcome
    age_band: str | None
    medical_needs: list[str]         # split from the comma-separated column
    language: str


class BlockState(BaseModel):
    block: str
    power_on: bool


class SimState(BaseModel):           # GET /api/state
    run_id: str
    sim_now: datetime | None
    outdoor_f: float
    speed: int                       # storm seconds per real second (300 or 30)
    live_call: bool
    blocks: list[BlockState]


class SeriesPoint(BaseModel):
    t: datetime
    temp_f: float
    est: bool = False                # True for offline estimates


class Series(BaseModel):             # GET /api/homes/{id}/series
    actual: list[SeriesPoint]
    predicted: list[SeriesPoint]     # next 6 storm hours, 15-minute steps


class Event(BaseModel):              # GET /api/events item, newest first
    t: datetime
    type: Literal["power_cut", "power_restored", "vent_blocked", "vent_cleared",
                  "threshold", "call_started", "call_result", "reset"]
    home_id: str | None
    text: str
    severity: Severity


class AccuracyRow(BaseModel):        # GET /api/accuracy item
    horizon_min: Literal[30, 60]
    k_source: Literal["learned", "global"]
    mae_f: float | None              # None when n == 0
    n: int
