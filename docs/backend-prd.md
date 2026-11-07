# SAVEL Backend PRD (v4)

Nov 7, 2026 · @Piyush

> Transcribed from `SAVEL_Backend_PRD_v4.pdf`. Code blocks, enums, schema and SQL are verbatim.

## Overview

The SAVEL backend turns raw home sensor readings into a ranked, explained list of who is getting dangerously cold, and serves it to the dashboard and the call agent. Piyush owns it end to end: FastAPI, Tiger Data, simulator integration, the prediction and risk API, and hosting on Vultr behind Caddy on the GoDaddy Registry domain.

| Area | Owner | Backend's role |
|---|---|---|
| Ingest, storage, predictions, risk loop, API, deploy, **and all simulator changes** (reset, speed, battery, outdoor_f, heating, run_id, DEMO_PHONE_HOMES) | Piyush | Builds and runs it |
| Voice agent, Twilio, webhook handler, call retries, Gemini extraction, risk weights, pitch | Harsh | Backend calls his `trigger_call()` and `risk_score()` |
| Dashboard, call panel, controls, status bar, demo driving | Huzaifa | Backend serves every endpoint he reads |

Scope is the hackathon build, Sat 3:15 PM to Sun 11:00 AM. All residents are synthetic; real calls go only to consenting team phones.

## Goals and success metrics

The backend succeeds when a power cut on the live domain turns into a correct countdown, a call, and a re-ranked list within seconds, backed by a real accuracy number.

**Goals**
1. Predict, per home, how many hours remain until 60°F and 50°F.
2. Rank homes by risk every 5 seconds (see FR8: 2 s) and trigger a check-in call when a home crosses a threshold.
3. Keep estimating homes whose sensors go silent during an outage.
4. Prove the predictions with a measured error.
5. Run on a public HTTPS domain for the demo and the sponsor prizes.

**Non-goals:** real resident data, real sensors at scale, or medical-grade thresholds; choosing risk weights or writing call scripts (Harsh); UI design (Huzaifa); auth, multi-tenant support, or long-term data retention.

| Metric | Target |
|---|---|
| Ingest throughput | 40 readings per tick, one DB round trip per batch |
| Risk loop | Runs every 2 s; each cycle under 1 s for 40 homes |
| Power cut to dashboard change | Under 5 s (2 s loop + 2 s dashboard poll) |
| Visible action at demo speed (300×) | First Block B home reaches warning within 40 s of a reset; Block B is already cooling the moment judges look |
| Prediction error, 60 min ahead | Reported for learned k and global k; learned k lower |
| Live domain stability | Full demo runs 3 times in a row with reset between, same behavior each run |
| Sponsor prizes enabled | Tiger Data, Vultr, GoDaddy Registry (plus Gemini and ElevenLabs from Harsh) |

## Users and stories

- As a **responder** on the dashboard, I see homes ranked by risk with hours left to 50°F, so I know who to reach first.
- As a **responder**, I see when a home's sensor went silent and its temperature is an estimate, so silence raises concern instead of hiding it.
- As the **call agent** (Harsh), I'm triggered once per home per outage with a reason, so residents aren't called repeatedly.
- As the **demo driver** (Huzaifa), I can cut power, block a vent, change outdoor temperature, change speed and reset, so the demo runs the same way every time.
- As a **judge**, I can see the prediction error at 30 and 60 minutes ahead, so I trust the countdowns.

## Functional requirements

Every requirement is P0 unless marked; P1 items are the first to cut.

| ID | Requirement | Priority |
|---|---|---|
| FR1 | Ingest accepts a JSON array (or `{readings: [...]}`) of readings `{time, home_id, temp_f, co_ppm, power_on, heating, outdoor_f, run_id}` and writes each batch in one round trip. It tracks `sim_now`, the newest simulated timestamp. | P0 |
| FR2 | All time windows are measured from `sim_now`, never `now()`. Readings from a real sensor (`H-REAL`) are stamped with the current `sim_now` and run_id on arrival, because the sensor sends wall-clock time. | P0 |
| FR3 | Every reading carries the outdoor temperature at that moment (`outdoor_f`), so the cooling fit stays correct when the outdoor slider moves. | P0 |
| FR4 | Cooling logic uses `heating`, not `power_on`: a home is cooling when its heat is off for any reason (power cut or furnace shut off by a blocked vent). | P0 |
| FR5 | Each home's k is fit on its **last 10 readings with `heating` false** in the current run, using each reading's own `outdoor_f`; no fixed time window, so the fit works at any speed. Readings with T ≤ T_out are skipped; homes with fewer than 10 such readings use the median k. | P0 |
| FR6 | `hours_to_60` and `hours_to_50` come from Newton's law; k ≤ 0 means "not cooling" and returns null. | P0 |
| FR7 | Every home gets a status: heated, cooling, warning, critical, or leaving (rules in Prediction model). | P0 |
| FR8 | A background loop recomputes state, predictions, status and risk **every 2 seconds** and caches the result. Risk comes from Harsh's `risk_score(home, call)`. | P0 |
| FR9 | The loop calls `trigger_call(home_id, reason)` once per episode when **heating is off and status is warning or critical, or CO is at or above 35 ppm**. A home that regains heat and is still warming below 60°F does not trigger. The episode clears when `heating` turns true again. `trigger_call` returns immediately (the call runs in a background task); Harsh's code owns retries and "unreachable". | P0 |
| FR10 | **Call-time speed:** when a live (not scripted) call starts, Harsh's code calls the backend's `set_live_call(True)`, which drops the simulator to 30×; `set_live_call(False)` at call end restores 300×. A 1-minute call then covers 30 storm minutes instead of 5 hours. | P0 |
| FR11 | Every 10 simulated minutes, log forecasts 30 and 60 minutes ahead with learned k and global k, tagged with run_id. | P0 |
| FR12 | `/api/accuracy` scores each forecast against the actual temperature at its target time, **linearly interpolated between the two readings that bracket it**, in the same run; only homes unheated the whole window count. Forecasts with no bracketing pair are skipped. | P0 |
| FR13 | `/api/events` returns the latest 20 events of the current run in the shape `{t, type, home_id, text, severity}`. | P0 |
| FR14 | Simulator proxy: `POST /api/sim/{action}/{arg}` for cut_power, restore_power, block_vent, clear_vent, outdoor, speed; `POST /api/sim/reset` with no argument. Unknown actions return 400. | P0 |
| FR15 | **Reset** starts a new run_id with the same random seed, so every run behaves the same, and opens **pre-warmed**: 9:00 PM, Block B already 80 storm minutes into its outage, speed 300×. The backend clears `sim_now`, the call dedupe set, live-call state, the cache and events. Old rows stay; every query filters by the current run_id. | P0 |
| FR16 | A home with no readings for 5 simulated minutes is `online = false`; its temperature is estimated from its last reading and learned k, flagged `est: true`. | P1 |
| FR17 | Simulator changes (owned by Piyush, none exist today): `/speed/{x}`, `/reset`, `/clear_vent/{id}`, `/state`; fixed `SEED`; per-home `battery` flag (about 25% without) written to `homes.json`; homes without battery stop reporting while power is out; `outdoor_f`, `heating` and `run_id` on every reading; noise ±0.3°F (today 0.05); **default speed 300×** (5 storm minutes per real second; homes cross 60°F in about 10–40 s). | P0 (battery: P1) |
| FR18 | Simulator setting `DEMO_PHONE_HOMES` maps the three team phones to H-13 (Block B, on oxygen), H-16 (Block B, 80+) and H-27 (Block C, the CO-vent home), so both the outage and the CO moment ring a real phone. Today phones go to H-01 to H-03 in Block A and would never ring. | P0 |

## API contract

All routes live under `/api` on one HTTPS origin; Caddy forwards them to FastAPI on port 8000.

| Method and path | Returns or does | Consumer |
|---|---|---|
| `GET /api/health` | `ok`, `sim_now`, run_id, rows ingested | Team, monitoring |
| `GET /api/state` | `{run_id, sim_now, outdoor_f, speed, live_call, blocks: [{block, power_on}]}` | Status bar, control buttons |
| `POST /api/ingest` | Inserts `[{time, home_id, temp_f, co_ppm, power_on, heating, outdoor_f, run_id}]`; `H-REAL` readings are restamped with `sim_now` | Simulator, real sensor |
| `GET /api/homes` | `[{id, block, lat, lon, temp_f, co_ppm, power_on, heating, online, k_est, k_source, hours_to_60, hours_to_50, status, risk, call_status, outcome, age_band, medical_needs, language}]`, sorted by risk | Dashboard |
| `GET /api/homes/{id}/series` | `{actual: [{t, temp_f, est}], predicted: [{t, temp_f}]}` for the current run | Home detail chart |
| `GET /api/events` | Latest 20 events `{t, type, home_id, text, severity}` of the current run | Event log |
| `GET /api/calls/current` | `{home_id, phase, source, language, transcript[], extracted}` (Harsh implements) | Call panel |
| `POST /api/calls/webhook` | ElevenLabs post-call transcript (Harsh implements) | ElevenLabs |
| `POST /api/sim/{action}/{arg}` | cut_power, restore_power, block_vent, clear_vent, outdoor, speed | Control buttons |
| `POST /api/sim/reset` | New run, same seed, pre-warmed start (FR15) | Reset button |
| `GET /api/accuracy` | `[{horizon_min, k_source, mae_f, n}]` for the current run | Accuracy panel |

Errors return JSON with `detail`; invalid ingest returns 422. CORS allows the Vite dev server on `localhost:5173`.

**Enums** (fixed values; the dashboard maps each to a label and color)

| Field | Values |
|---|---|
| `status` | heated, cooling, warning, critical, leaving |
| `call_status` | none, queued, ringing, in_call, done, no_answer, unreachable |
| `outcome` | none, ok, needs_help, medical, leaving, unreachable |
| `phase` (calls/current) | ringing, in_call, extracting, done, no_answer |
| `source` (calls/current) | live, scripted |
| `language` | Language codes exactly as in `homes.json` |
| event `type` | power_cut, power_restored, vent_blocked, vent_cleared, threshold, call_started, call_result, reset |
| event `severity` | info, warning, critical |

**Pydantic models** (`api/models.py`; field names and types are the contract, never rename)

```python
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
```

**Example responses** (shapes the dashboard is built against)

```jsonc
// GET /api/homes (one item)
{"id": "H-13", "block": "B", "lat": 42.9561, "lon": -78.8412, "temp_f": 58.4, "co_ppm": 0.0,
 "power_on": false, "heating": false, "online": true, "k_est": 0.112, "k_source": "learned",
 "hours_to_60": 0.0, "hours_to_50": 1.62, "status": "warning", "risk": 78,
 "call_status": "ringing", "outcome": "none", "age_band": "75+",
 "medical_needs": ["oxygen"], "language": "en"}

// GET /api/state
{"run_id": "r-0007", "sim_now": "2026-11-08T02:20:00Z", "outdoor_f": 5.0, "speed": 300,
 "live_call": false, "blocks": [{"block": "A", "power_on": true}, {"block": "B", "power_on": false},
 {"block": "C", "power_on": true}, {"block": "D", "power_on": true}]}

// GET /api/events (one item)
{"t": "2026-11-08T02:18:00Z", "type": "threshold", "home_id": "H-13",
 "text": "H-13 dropped below 60°F", "severity": "warning"}

// GET /api/accuracy
[{"horizon_min": 30, "k_source": "global", "mae_f": 0.91, "n": 48},
 {"horizon_min": 30, "k_source": "learned", "mae_f": 0.34, "n": 48}]
```

The numbers in these examples are illustrative, not measured.

**Error cases**

| Case | Response |
|---|---|
| Unknown home id on `/api/homes/{id}/series` | 404 `{"detail": "unknown home H-99"}` |
| Unknown sim action or bad argument | 400 `{"detail": "unknown action foo"}` |
| Ingest body fails validation | 422 with the Pydantic error |
| Simulator unreachable from the proxy | 502 `{"detail": "simulator unavailable"}` |
| Database unreachable | `/api/health` returns 503 |

## Data model

Four tables in Tiger Cloud; `readings` is a hypertable on `time`.

| Table | Columns | Written by |
|---|---|---|
| `homes` | id (PK), block, lat, lon, age_band, medical_needs, language, phone, battery | `seed_homes.py` from the simulator's `homes.json` |
| `readings` | time, run_id, home_id, temp_f, co_ppm, power_on, heating, outdoor_f | Ingest |
| `calls` | id (serial), run_id, home_id, started_at, status, transcript, extracted (jsonb), outcome | Harsh's call flow |
| `predictions` | made_at, run_id, home_id, horizon_min (30 or 60), k_source (learned or global), target_time, predicted_f | Risk loop |

`predictions` is added so `/api/accuracy` has forecasts to compare against. `run_id` on readings, calls and predictions keeps runs apart after a reset, because simulated time restarts and would otherwise overlap; index `readings` on `(run_id, home_id, time DESC)`. Skip continuous-aggregate refresh policies: they run on wall-clock time.

**Exact schema** (`api/schema.sql`; the same file runs on local TimescaleDB and Tiger Cloud)

```sql
CREATE TABLE IF NOT EXISTS homes (
  id            text PRIMARY KEY,
  block         text NOT NULL,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  age_band      text,
  medical_needs text NOT NULL DEFAULT '',   -- comma-separated, e.g. 'oxygen,mobility'
  language      text NOT NULL DEFAULT 'en',
  phone         text,
  battery       boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS readings (
  time      timestamptz NOT NULL,           -- simulated time
  run_id    text NOT NULL,
  home_id   text NOT NULL,
  temp_f    double precision NOT NULL,      -- indoor °F
  co_ppm    double precision NOT NULL DEFAULT 0,
  power_on  boolean NOT NULL,
  heating   boolean NOT NULL,               -- furnace actually heating
  outdoor_f double precision NOT NULL       -- outdoor °F at this reading
);
SELECT create_hypertable('readings', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS readings_run_home_time ON readings (run_id, home_id, time DESC);

CREATE TABLE IF NOT EXISTS calls (
  id          serial PRIMARY KEY,
  run_id      text NOT NULL,
  home_id     text NOT NULL,
  started_at  timestamptz NOT NULL,         -- simulated time
  status      text NOT NULL,                -- call_status enum
  source      text NOT NULL,                -- live | scripted
  transcript  text,
  extracted   jsonb,
  outcome     text NOT NULL DEFAULT 'none'  -- outcome enum
);

CREATE TABLE IF NOT EXISTS predictions (
  made_at     timestamptz NOT NULL,         -- simulated time
  run_id      text NOT NULL,
  home_id     text NOT NULL,
  horizon_min int NOT NULL,                 -- 30 or 60
  k_source    text NOT NULL,                -- learned | global
  target_time timestamptz NOT NULL,
  predicted_f double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS predictions_run_target ON predictions (run_id, target_time);
```

## Prediction model

Each home follows Newton's law of cooling with one learned parameter, k.

```
T(t) = T_{out} + (T_0 - T_{out})\, e^{-k t}
```

- **Learning k:** regress ln(T − T_out) on time over each home's last 10 readings with `heating` false in the current run (`regr_slope` in SQL), with T_out from each reading's own `outdoor_f`. Skip readings with T ≤ T_out. k is per hour; under 10 points, use the median k. A count-based window works at 300× (readings 5 storm minutes apart) and at 30× during a call.
- **Countdown:** hours to a threshold = ln((T_now − T_out) / (T_threshold − T_out)) / k, using the current outdoor temperature. Zero if already below; null if heating is on, the threshold is at or below outdoor temperature, or k ≤ 0 (not cooling).
- **Offline estimate:** T = T_out + (T_last − T_out) · e^(−k · hours silent).
- **Risk:** a deterministic score from Harsh's `risk_score()`; Gemini never sets the ranking.
- **Evaluation:** mean absolute error of 30- and 60-minute forecasts, learned k against one global k. The actual value at each target time is interpolated linearly between the two readings that bracket it in the same run; only homes unheated the whole window count. Sensor noise of ±0.3°F keeps the comparison honest.

**Status rules** (checked top to bottom; first match wins)

| Status | Rule |
|---|---|
| Critical (CO) | CO at or above 35 ppm, regardless of anything else |
| Leaving | The latest call outcome is `leaving`; set by Harsh's call flow; shown as "Safe, leaving" |
| Critical | Below 50°F, or under 1.5 h to 50°F |
| Warning | Below 60°F, or under 4 h to 50°F |
| Cooling | Heating off, none of the above |
| Heated | Heating on |

A call triggers only when heating is off and status is warning or critical, or on CO (FR9), so a home warming back up never triggers a repeat call.

## Exact logic

Implement these as written; the dashboard and tests assume them. Both SQL queries were run against a fixture: the k fit recovers k = 0.10 from synthetic data, and the interpolation case returns an error of 0.20°F.

**k fit** (`$1` = current run_id, `$2` = `sim_now`)

```sql
WITH recent AS (
  SELECT home_id, time, temp_f, outdoor_f,
         row_number() OVER (PARTITION BY home_id ORDER BY time DESC) AS rn
  FROM readings
  WHERE run_id = $1 AND NOT heating AND temp_f > outdoor_f + 0.5
    AND time > $2 - interval '6 hours'        -- bounds the scan only
)
SELECT home_id,
       -regr_slope(ln(temp_f - outdoor_f), extract(epoch FROM time)) * 3600 AS k_per_hour,
       count(*) AS n
FROM recent
WHERE rn <= 10
GROUP BY home_id
HAVING count(*) >= 10;
```

Homes missing from the result use the median of the fitted k values (`k_source = "median"`). A fitted k ≤ 0 is treated as not cooling.

**Math and status** (`api/predict.py`)

```python
import math

def hours_to(t_now, t_out, threshold, k):
    """Storm hours until a cooling home reaches threshold. None = never."""
    if t_now <= threshold:
        return 0.0
    if k is None or k <= 0 or threshold <= t_out:
        return None
    return math.log((t_now - t_out) / (threshold - t_out)) / k

def estimate(t_last, t_out, k, hours_silent):
    return t_out + (t_last - t_out) * math.exp(-k * hours_silent)

def status(temp_f, co_ppm, heating, h50, outcome):
    if co_ppm >= 35:
        return "critical"
    if outcome == "leaving":
        return "leaving"
    if temp_f < 50 or (h50 is not None and h50 < 1.5):
        return "critical"
    if temp_f < 60 or (h50 is not None and h50 < 4):
        return "warning"
    if not heating:
        return "cooling"
    return "heated"
```

`hours_to` is called only when `heating` is false; otherwise both countdowns are None.

**Call trigger and episode reset** (`api/loop.py`, every 2 s, per home)

```python
should_call = (not h.heating and h.status in ("warning", "critical")) or h.co_ppm >= 35
if should_call and h.id not in state.episodes:
    state.episodes.add(h.id)
    state.add_event("threshold", h.id, f"{h.id} reached {h.status}", h.status)
    await trigger_call(h.id, reason=h.status)   # returns immediately
if h.heating and h.co_ppm < 35:
    state.episodes.discard(h.id)                # next heat loss is a new episode
```

**Accuracy** (`$1` = current run_id, `$2` = `sim_now`)

```sql
SELECT p.horizon_min, p.k_source,
  round(avg(abs(p.predicted_f - CASE WHEN b.time = a.time THEN a.temp_f
       ELSE a.temp_f + (b.temp_f - a.temp_f) * extract(epoch FROM p.target_time - a.time)
                                              / extract(epoch FROM b.time - a.time) END))::numeric, 2) AS mae_f,
  count(*) AS n
FROM predictions p
JOIN LATERAL (SELECT time, temp_f FROM readings r
              WHERE r.run_id = p.run_id AND r.home_id = p.home_id AND r.time <= p.target_time
              ORDER BY r.time DESC LIMIT 1) a ON true
JOIN LATERAL (SELECT time, temp_f FROM readings r
              WHERE r.run_id = p.run_id AND r.home_id = p.home_id AND r.time >= p.target_time
              ORDER BY r.time LIMIT 1) b ON true
WHERE p.run_id = $1 AND p.target_time <= $2
  AND NOT EXISTS (SELECT 1 FROM readings r
                  WHERE r.run_id = p.run_id AND r.home_id = p.home_id
                    AND r.time BETWEEN p.made_at AND p.target_time AND r.heating)
GROUP BY p.horizon_min, p.k_source
ORDER BY p.horizon_min, p.k_source;
```

The endpoint always returns all four rows (30/60 × learned/global), with `mae_f = null, n = 0` for empty groups.

## Infrastructure and deployment

One Vultr VM runs three containers with Docker Compose (Caddy, FastAPI api, simulator), and the only public entry point is Caddy on ports 80 and 443. The simulator talks to FastAPI on the internal network; the dashboard and ElevenLabs reach FastAPI only through Caddy. FastAPI talks to Tiger Cloud (homes, readings, calls, predictions; AWS us-east-1).

- **Repo:** `api/`, `sim/`, `web/`, `deploy/` (`docker-compose.yml`, `Caddyfile`), `README.md`.
- **Domain:** claimed through GoDaddy Registry; A record to the VM's IP with a low TTL, set in the first hour.
- **VM:** Ubuntu 24.04, 2 GB RAM, New York region, Docker installed, firewall open on 22, 80 and 443.
- **Database:** Tiger Cloud service in AWS us-east-1; connection string in `.env` as `DATABASE_URL`.
- **Deploy:** `docker compose up -d` from `deploy/`; Caddy issues the certificate once DNS resolves.
- **Before Vultr is live:** a cloudflared tunnel gives Harsh a public HTTPS webhook URL.
- **Local development:** `docker-compose.dev.yml` runs a `timescale/timescaledb:latest-pg16` container with `api/schema.sql` mounted as an init script, so tests run with no internet or Tiger credentials. Tiger Cloud uses the same SQL.

## Repo layout and modules

| Path | Owns | Key functions |
|---|---|---|
| `CLAUDE.md` | Rules and commands for coding agents | — |
| `docs/backend-prd.md` | This PRD | — |
| `api/main.py` | App, CORS, lifespan (pool, loop task), router includes | `app` |
| `api/db.py` | asyncpg pool | `get_pool()` |
| `api/models.py` | Pydantic models above | — |
| `api/state.py` | In-memory state: run_id, sim_now, cache, episodes, events (deque of 20), live_call | `State.reset()`, `add_event()` |
| `api/ingest.py` | `POST /api/ingest`, H-REAL restamping | `ingest()` |
| `api/predict.py` | Pure math, no I/O | `hours_to()`, `estimate()`, `status()` |
| `api/queries.py` | All SQL strings | `K_FIT_SQL`, `LATEST_SQL`, `ACCURACY_SQL` |
| `api/loop.py` | The 2-second loop, trigger, prediction logging | `run_loop()`, `compute_homes()` |
| `api/simctl.py` | Talks to the simulator | `sim_post(action, arg)`, `set_live_call(active)` |
| `api/routes.py` | Read endpoints and the sim proxy | — |
| `api/risk.py` | **Stub Harsh replaces**: a default `risk_score(home, call) -> int` (status base 0/20/50/80, +15 medical, +10 age 75+, +10 offline) | `risk_score()` |
| `api/calls.py` | **Stub Harsh replaces**: `trigger_call()` logs an event and marks the call scripted-done; `GET /api/calls/current` returns null; webhook returns 204 | `trigger_call()` |
| `api/seed_homes.py` | Loads `sim/homes.json` into `homes` | `main()` |
| `api/schema.sql` | Exact schema | — |
| `api/tests/` | pytest suite (see Tests) | — |
| `sim/simulator.py` | Simulator with FR17 and FR18 changes | — |
| `scripts/smoke.sh` | End-to-end check | — |
| `deploy/docker-compose.yml`, `deploy/Caddyfile` | Production on Vultr | — |
| `docker-compose.dev.yml` | Local TimescaleDB + api + sim | — |
| `.env.example` | Every variable, no secrets | — |

The stubs mean Piyush is never blocked on Harsh: the whole backend runs and passes its tests with them, and Harsh swaps in his versions with the same signatures.

## Configuration

All settings come from environment variables; `.env.example` lists them, and `.env` is never committed.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/savel` | Local TimescaleDB or Tiger Cloud |
| `SIM_URL` | `http://localhost:8001` | Where the API reaches the simulator |
| `INGEST_URL` | `http://localhost:8000/api/ingest` | Where the simulator posts readings |
| `SPEEDUP` | `300` | Storm seconds per real second |
| `LIVE_CALL_SPEEDUP` | `30` | Speed during a live call |
| `SEED` | `42` | Random seed reused on every reset |
| `PREWARM_BLOCK` | `B` | Block that starts in an outage after reset |
| `PREWARM_MINUTES` | `80` | How far into that outage reset starts |
| `OUTDOOR_F` | `5` | Starting outdoor temperature |
| `DEMO_PHONE_HOMES` | `H-13:+1…,H-16:+1…,H-27:+1…` | Team phones mapped to homes |
| `LOOP_SECONDS` | `2` | Risk loop interval |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

`api/requirements.txt` pins: `fastapi==0.115.6`, `uvicorn[standard]==0.32.1`, `asyncpg==0.30.0`, `httpx==0.28.1`, `pytest==8.3.4`, `pytest-asyncio==0.24.0`.

## Non-functional requirements

- **Performance:** ingest 40 rows per tick in one round trip over a pooled connection; the risk loop runs every 2 s and each cycle finishes under 1 s; `trigger_call` never blocks the loop.
- **Latency:** Vultr VM (New York) and Tiger Cloud (AWS us-east-1) in nearby regions.
- **Reliability:** the demo runs three times in a row on the live domain; `/api/sim/reset` starts a clean, pre-warmed run with a new run_id and the same seed, so all three runs behave the same.
- **Fallback:** the whole stack starts on one laptop with `docker compose up`.
- **Security:** secrets only in `.env` (never committed); the simulator has no public port; the proxy accepts only known actions; the webhook signature is verified (Harsh).
- **Privacy:** synthetic residents only; real calls only to verified, consenting team phones mapped by `DEMO_PHONE_HOMES`.
- **Repo:** public by 11:00 PM Saturday, with a README that runs the stack in one command.

## Guardrails for coding agents

These rules look odd out of context; an agent must not "fix" them.

- **One uvicorn worker.** The loop, episodes and call state live in memory; several workers would run the loop several times and call residents repeatedly. Never add `--workers`.
- **Never `now()` or wall-clock time** in queries or logic; use `sim_now`.
- **Filter every query by the current run_id.**
- **Don't change API shapes, field names or enum values.** The dashboard is built against the models and examples above.
- **Gemini never sets the ranking.** Risk is deterministic.
- **Don't edit `api/risk.py` or `api/calls.py` beyond the stubs;** Harsh owns them.
- **No secrets in code or commits.**

## Decision log

| Decision | Why | Rejected alternative |
|---|---|---|
| Default speed 300× | Homes cross 60°F in about 10–40 s, inside a 4-minute pitch | 12× (a storm hour takes 5 real minutes) |
| 30× during a live call | A 1-minute call covers 30 storm minutes, not 5 hours | Fixed speed |
| k fit on last 10 unheated readings | Works at any speed | Fixed 45-minute window (too few points at 300×) |
| Cooling keyed on `heating` | A blocked vent cools a home with power on | `power_on` |
| `outdoor_f` per reading | Outdoor slider changes T_out mid-fit | Current outdoor temp only |
| run_id on every row, same seed on reset | Repeatable runs; no overlapping simulated time | Truncating tables |
| Reset pre-warmed (Block B 80 storm minutes in) | Dashboard shows action the moment judges look | Cold start |
| Accuracy by interpolation | Readings are minutes apart at 300× | Nearest reading within 1 minute |
| Trigger needs heating off (or CO) | No repeat call while a home warms back up | Any warning status |
| Loop every 2 s | Under 5 s end to end with the 2 s dashboard poll | 5 s loop |
| H-REAL restamped with `sim_now` | Sensor sends wall-clock time | Trusting its timestamp |

## Dependencies and interfaces

| With | Interface | Needed by |
|---|---|---|
| Harsh | `risk_score(home, call) -> int` in `api/risk.py` (call may be None); he owns the weights | 5:15 PM |
| Harsh | `async trigger_call(home_id: str, reason: str)` in `api/calls.py`; returns immediately and runs the call in a background task; Harsh owns retries (no answer → retry after 20 simulated minutes → unreachable) | 8:15 PM |
| Harsh | His code calls the backend's `set_live_call(True)` when a live call starts and `set_live_call(False)` when it ends (speed 30× during the call, 300× otherwise) | 8:15 PM |
| Harsh | Call outcome `leaving` sets the home's status to Leaving; uses the enum values in the API contract | 8:15 PM |
| Harsh | Webhook URL `https://<domain>/api/calls/webhook` (or a tunnel until DNS is live) | 5:15 PM |
| Harsh | Three phone numbers for `DEMO_PHONE_HOMES` (H-13, H-16, H-27) | 5:15 PM |
| Huzaifa | Sample `/api/homes`, `/api/state` and `/api/events` JSON; enums and status rules tables | 4:15 PM |
| Huzaifa | `web/dist` build output for Caddy to serve | 8:15 PM |
| External | Tiger Cloud, Vultr credits, GoDaddy Registry domain | 4:15 PM |

## Tests: the definition of done

A task is done only when its tests pass with `pytest -q` against the local TimescaleDB container. Values are checked to two decimals.

| Test | Setup | Expected |
|---|---|---|
| `test_hours_to` | t_now 64°F, t_out 5°F, k 0.10 | 0.70 h to 60°F; 2.71 h to 50°F |
| `test_hours_to_edges` | t_now 48 vs 50; threshold 4 with t_out 5; k = 0 | 0.0; None; None |
| `test_status_precedence` | CO 40 + leaving; leaving + 45°F; 45°F; 62°F with h50 1.2; 62°F with h50 3.5; 58°F heating on; 65°F heating off h50 6; 68°F heating on | critical; leaving; critical; critical; warning; warning; cooling; heated |
| `test_trigger_once` | Home at warning, heating off, for 3 loop cycles | `trigger_call` called once |
| `test_no_repeat_call` | After a call, heating returns, home at 55°F and warming | No second call; episode cleared |
| `test_co_trigger` | Heating off by blocked vent, CO 40, 66°F | One call |
| `test_k_fit` | 15 readings, T = 5 + 59·e^(−0.1·h), every 5 storm minutes | k = 0.10 ± 0.005, n = 10 |
| `test_accuracy_interpolation` | Readings 60.0°F at 01:00 and 58.0°F at 01:10; forecast 59.0 for 01:04; forecast 59.5 for 01:00 (global) | learned mae 0.20; global mae 0.50 |
| `test_reset_isolation` | Rows in run A, reset, rows in run B | `/api/homes`, `/api/events`, `/api/accuracy` show only run B |
| `test_real_sensor_restamp` | Ingest H-REAL with a wall-clock time | Stored time = `sim_now`, run_id = current |
| `test_errors` | Unknown home; unknown sim action; bad ingest body | 404; 400; 422 |

**Smoke test** (`scripts/smoke.sh`): posts `/api/sim/reset`, polls `/api/homes` every 2 s, and passes when a Block B home shows status warning within 40 s and `/api/health` row count is rising.

## Build tasks for Claude Code

| # | Task | Verify with |
|---|---|---|
| 1 | Repo skeleton, `CLAUDE.md`, `.env.example`, `docker-compose.dev.yml`, `api/schema.sql` | `docker compose -f docker-compose.dev.yml up -d db && psql $DATABASE_URL -c '\dt'` lists 4 tables |
| 2 | Simulator changes (FR17, FR18) | `curl localhost:8001/state` shows run_id, speed 300; readings include heating and outdoor_f |
| 3 | `db.py`, `models.py`, `state.py`, ingest, seed | `/api/health` row count grows by 40 per tick; `test_real_sensor_restamp` passes |
| 4 | `predict.py` and its tests | `pytest -q api/tests/test_predict.py` passes |
| 5 | `queries.py`, `loop.py`, stubs, `/api/homes`, `/api/state`, sim proxy | Smoke test passes; `test_trigger_once`, `test_no_repeat_call`, `test_co_trigger` pass |
| 6 | Series, events, accuracy, reset, offline estimate | `test_accuracy_interpolation`, `test_reset_isolation`, `test_errors` pass |
| 7 | `deploy/` Docker Compose + Caddy on Vultr | `curl https://<domain>/api/health` returns ok |

## Milestones and acceptance criteria

| By | Milestone | Acceptance check |
|---|---|---|
| Sat 4:15 PM | Database, ingest, server | `/api/health` rows grow by 40 per tick; `count(*)` on readings grows in Tiger |
| Sat 5:15 PM | Simulator changes, public URL | `https://<domain>/api/health` (or a tunnel) answers; readings carry `outdoor_f`, `heating`, `run_id`; reset gives a new run_id, the same seed, and Block B already 80 storm minutes into its outage; default speed is 300×; H-13, H-16 and H-27 hold the team phones |
| Sat 7:00 PM | Predictions, status and homes API | Within 40 s of a reset, a Block B home reaches warning on the live dashboard; blocking H-27's vent with power on cools it and raises CO; moving the outdoor slider doesn't break k |
| Sat 11:00 PM | Deployed, call loop wired | On the live domain, H-13 reaching warning rings a team phone, speed drops to 30× for the call and returns to 300× after; the home re-ranks after the webhook; a home warming back up does not get a second call; repo public |
| Sun 3:00 AM | Offline estimates, accuracy | Silent homes show estimates; `/api/accuracy` returns errors for both k sources, current run only, with interpolated actuals |
| Sun 9:30 AM | Feature freeze | Full demo runs 3 times on the live domain with reset between and the same behavior each time; laptop fallback tested |
| Sun 11:00 AM | Final submission | Devpost opted into Radial Atoms, General, AI/ML, UI/UX, Tiger Data, Vultr, GoDaddy, Gemini and ElevenLabs |

## Risks, cut order and open questions

| Risk | Mitigation |
|---|---|
| Demo too slow to show anything (12× = 5 real minutes per storm hour) | Default 300×; reset opens pre-warmed with Block B 80 storm minutes into its outage (FR15, FR17) |
| A real call skips hours of storm time | Speed drops to 30× during a live call, back to 300× after (FR10) |
| Too few readings for a time-window fit at high speed | k fit on the last 10 unheated readings, not a time window (FR5) |
| Accuracy finds no matching reading at high speed | Actual value interpolated between the bracketing readings (FR12) |
| A home warming back up triggers a repeat call | Trigger requires heating off, or CO (FR9) |
| Runs behave differently between demos | Fixed seed reused on every reset (FR15) |
| Simulator lacks the required features | Piyush adds them before 5:15 PM (FR17) |
| Outdoor slider changes T_out mid-fit | `outdoor_f` stored per reading (FR3) |
| Blocked vent cools a home with power still on | Cooling logic keys off `heating` (FR4) |
| Reset overlaps simulated time | run_id on every row; backend state cleared on reset (FR15) |
| Real sensor's wall-clock time breaks `sim_now` | H-REAL readings restamped with `sim_now` (FR2) |
| DNS propagation delays HTTPS | A record set in the first hour with a low TTL; cloudflared tunnel as a stopgap |
| Live domain fails during judging | Laptop runs the full stack with `docker compose up` |
| Keys leak when the repo goes public | `.env` in `.gitignore` from the first commit; search the repo before publishing |

**Cut order for the backend:** sensor-offline estimation (FR16) first, then the battery flag. Never cut the homes API, countdowns, the call trigger or `/api/accuracy`.

**Open questions**
- [ ] Claim the domain now: savel.<tld>, whichever TLD the GoDaddy Registry link offers.
- [ ] Do the MLH Vultr credits need a code from the MLH table?
- [x] Does `homes.json` include a battery field? No; FR16 adds it.
