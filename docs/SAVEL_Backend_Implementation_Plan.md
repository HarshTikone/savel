# SAVEL Backend — Implementation Plan for Claude Code

**Owner:** Piyush · **Repo:** `https://github.com/HarshTikone/savel.git` · **Branch:** `backend`
**Source of truth:** `docs/backend-prd.md` (SAVEL Backend PRD v4). This plan tells you *how and in what order* to build it. Where this plan adds a rule the PRD does not have, the rule is marked **[PLAN]** and wins.

---

## 0. How to work (read first, follow every part)

You build the backend in **10 parts**. Each part has: goal, files, exact requirements, a **Verify gate**, and a **Commit**. Rules:

1. **One part at a time.** Do not start part N+1 until part N's Verify gate passes.
2. **Verify gate = proof.** Run every command in the gate. Paste the key output into `docs/backend-progress.md` under that part. If a check fails, fix it and re-run the whole gate. Never mark a part done with a failing check.
3. **Commit and push after every part:**
   ```bash
   git add -A
   git status            # confirm no .env, no secrets, nothing in web/
   git commit -m "backend: part N - <title>"
   git push origin backend
   ```
4. **Tick the checklist** in `docs/backend-progress.md` (created in Part 0) in the same commit.
5. **Stay in your lane:** never edit `web/` (Huzaifa). Create `api/risk.py` and `api/calls.py` only as the stubs described in Part 6; Harsh replaces them.
6. **If something in the PRD is ambiguous,** follow this plan; if this plan is silent, pick the simplest option, write the choice in `docs/backend-progress.md` under "Decisions made during build", and continue.
7. **Steps marked HUMAN** need Piyush (accounts, cloud consoles, DNS, phone numbers). Stop, print exactly what is needed, and wait.

### Guardrails (never "fix" these)
- **One uvicorn worker.** Loop, episodes and call state are in memory. Never add `--workers`.
- **Never use `now()` or wall-clock time** in SQL or logic. Use `sim_now`.
- **Filter every query by the current `run_id`.**
- **Never change API paths, field names, types or enum values** from the PRD models.
- **Risk is deterministic.** No LLM in the ranking.
- **No secrets in code or commits.** `.env` is in `.gitignore` from the first commit.

### Fixed decisions (do not revisit)
| Decision | Value |
|---|---|
| Default speed | 300 storm seconds per real second (1 tick = 1 real s = 5 storm min) |
| Live-call speed | 30 |
| k fit | last 10 unheated readings per home, current run |
| Cooling key | `heating` (not `power_on`) |
| Accuracy | linear interpolation between bracketing readings |
| Call trigger | `(not heating and status in {warning, critical}) or co_ppm >= 35`, once per episode |
| Loop interval | 2 s |
| Reset | new `run_id`, same seed, pre-warm configurable (see Part 2) |

### Fixes to PRD v4 included in this plan **[PLAN]**
1. **Offline threshold:** PRD says "no reading for 5 storm minutes", but at 300× readings are exactly 5 storm minutes apart, so every home would flicker offline. Use: **offline when `sim_now - last_reading_time > 3 × current speed` storm seconds** (3 missed ticks).
2. **Overlapping live calls:** `set_live_call` keeps a **counter**. First live call saves the current speed and sets 30×; speed is restored only when the counter returns to 0. Restore the **saved** speed, not a hard-coded 300.
3. **Pre-warm is configurable:** `PREWARM_MINUTES` env (default 80 per PRD) and `POST /api/sim/reset?prewarm=N` override (0 = clean start). Pre-warm means team-phone homes may cross 60°F within seconds of reset; the team chooses the value for the pitch.
4. **Unique run_id:** `r-YYYYMMDDTHHMMSS` from wall clock at reset time (used only as an identifier, never as data time), so a simulator restart can never reuse an old run_id.
5. **Demo phone homes cool fast:** force k = 0.14 for every home listed in `DEMO_PHONE_HOMES` so real calls happen early.
6. **Measurement noise:** add uniform ±0.3°F noise to the *reported* temperature only; keep the true simulated temperature clean.
7. **Loop can be disabled for tests:** env `LOOP_ENABLED` (default 1). Tests set 0 and call `compute_homes()` directly.
8. PRD Goal 2 says "every 5 seconds"; the correct value is 2 s (FR8). Use 2 s.

---

## Target repo layout (end state)

```
savel/
  CLAUDE.md
  README.md
  .gitignore
  .env.example
  docker-compose.dev.yml
  docs/
    backend-prd.md
    backend-progress.md
  api/
    Dockerfile
    requirements.txt
    __init__.py
    main.py  db.py  models.py  state.py  ingest.py  predict.py
    queries.py  loop.py  simctl.py  routes.py  risk.py  calls.py
    seed_homes.py  schema.sql
    tests/
      conftest.py  test_predict.py  test_ingest.py  test_loop.py
      test_queries.py  test_api.py
  sim/
    Dockerfile
    requirements.txt
    simulator.py
    homes.json
  scripts/
    smoke.sh
  deploy/
    docker-compose.yml
    Caddyfile
  web/            # Huzaifa's. Do not touch.
```

---

## Part 0 — Branch, repo hygiene, progress tracker

**Goal:** a clean `backend` branch with rules and tracking in place.

**Steps**
1. `git clone https://github.com/HarshTikone/savel.git && cd savel` (or pull if already cloned). `git checkout -b backend` (or `git checkout backend` if it exists).
2. Save the PRD as `docs/backend-prd.md` (HUMAN: export the PRD v4 doc as Markdown and place it there if it is not already in the repo).
3. Create `.gitignore` with at least: `.env`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.venv/`, `node_modules/`, `web/dist/`.
4. Create `CLAUDE.md`:
   ```markdown
   # SAVEL backend rules for coding agents
   - Read docs/backend-prd.md and docs/SAVEL_Backend_Implementation_Plan.md before any change.
   - One uvicorn worker. Never add --workers.
   - Never use now() or wall-clock time in queries or logic; use sim_now.
   - Every query filters by the current run_id.
   - Never change API paths, field names, types or enum values (api/models.py is the contract).
   - Risk is deterministic; no LLM in ranking.
   - api/risk.py and api/calls.py are stubs owned by Harsh; do not extend them.
   - Never edit web/.
   - No secrets in code or commits; .env is gitignored.
   - Test: docker compose -f docker-compose.dev.yml up -d db && pytest -q api/tests
   - Smoke: bash scripts/smoke.sh
   ```
5. Save this plan as `docs/SAVEL_Backend_Implementation_Plan.md`.
6. Create `docs/backend-progress.md` with a checklist: `- [ ] Part 0` … `- [ ] Part 9`, plus sections "Verify output" and "Decisions made during build".

**Verify gate**
```bash
git status                      # on branch backend
test -f CLAUDE.md && test -f docs/backend-prd.md && test -f docs/backend-progress.md && echo OK
grep -q '^.env$' .gitignore && echo GITIGNORE_OK
```

**Commit:** `backend: part 0 - branch, rules, progress tracker`

---

## Part 1 — Config, schema, local TimescaleDB

**Goal:** a local database with the exact PRD schema, and every config variable documented.

**Files:** `.env.example`, `api/schema.sql`, `api/requirements.txt`, `docker-compose.dev.yml`

**`.env.example`** (no secrets):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/savel
SIM_URL=http://localhost:8001
INGEST_URL=http://localhost:8000/api/ingest
SPEEDUP=300
LIVE_CALL_SPEEDUP=30
SEED=42
PREWARM_BLOCK=B
PREWARM_MINUTES=80
OUTDOOR_F=5
DEMO_PHONE_HOMES=H-13:+10000000000,H-16:+10000000000,H-27:+10000000000
LOOP_SECONDS=2
LOOP_ENABLED=1
CORS_ORIGINS=http://localhost:5173
DOMAIN=savel.example
```

**`api/schema.sql`:** copy the "Exact schema" block from the PRD verbatim (homes, readings + `create_hypertable('readings', by_range('time'), if_not_exists => TRUE)` + index `(run_id, home_id, time DESC)`, calls, predictions + index `(run_id, target_time)`). Every statement must be idempotent (`IF NOT EXISTS`).

**`api/requirements.txt`** (pinned per PRD): `fastapi==0.115.6`, `uvicorn[standard]==0.32.1`, `asyncpg==0.30.0`, `httpx==0.28.1`, `pytest==8.3.4`, `pytest-asyncio==0.24.0`.

**`docker-compose.dev.yml`:** service `db` using `timescale/timescaledb:latest-pg16`, env `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=savel`, port `5432:5432`, mount `./api/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro`, healthcheck `pg_isready`. Services `api` and `sim` are added in Part 7.

**Verify gate**
```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d db
sleep 8
psql "postgresql://postgres:postgres@localhost:5432/savel" -c '\dt'      # 4 tables: homes, readings, calls, predictions
psql "postgresql://postgres:postgres@localhost:5432/savel" -c "SELECT hypertable_name FROM timescaledb_information.hypertables;"   # readings
psql "postgresql://postgres:postgres@localhost:5432/savel" -f api/schema.sql   # re-run succeeds (idempotent)
```

**Commit:** `backend: part 1 - config, schema, local timescaledb`

---

## Part 2 — Simulator (FR17, FR18 + plan fixes)

**Goal:** upgrade `sim/simulator.py` so it produces everything the backend needs. Start from the existing simulator (40 homes, Newton cooling, CO on blocked vent, demo controls) and change it as below.

**Homes (deterministic from `SEED`)**
- 40 homes `H-01`…`H-40`, blocks A–D (10 each, `H-01..H-10` = A, `H-11..H-20` = B, `H-21..H-30` = C, `H-31..H-40` = D), lat/lon around North Buffalo (center 42.9470, -78.8520).
- Fields: `id, block, lat, lon, age_band, medical_needs, language, phone, battery, k_per_hour`.
- `age_band` values: `18-39`, `40-64`, `65-74`, `75+` (ASCII hyphens).
- `medical_needs`: comma-separated string, empty or from `oxygen`, `mobility`, `heart`, `dialysis`.
- `language`: `en` (most), `es`, `ar`, `bn`.
- `battery`: about 25% `false`.
- `k_per_hour`: uniform 0.05–0.16.
- **Forced values:** H-13 `medical_needs="oxygen"`, `age_band="65-74"`; H-16 `age_band="75+"`, `medical_needs="mobility"`; H-27 `medical_needs=""` (CO-vent home); every home in `DEMO_PHONE_HOMES` gets `k_per_hour=0.14` and `battery=true`.
- `phone`: from `DEMO_PHONE_HOMES` (`H-13:+1...,H-16:+1...,H-27:+1...`) for listed homes; every other home gets a fake `+17165550100 + n` style number.
- `python sim/simulator.py --write-homes` writes `sim/homes.json` and exits. Commit `homes.json` (no real phone numbers in it: write the placeholder from `.env.example`, never a real number). **[PLAN]** Real numbers come only from the runtime env.

**State and physics per tick (1 real second, `dt = speed` storm seconds)**
- Heating = `power_on and not furnace_tripped`.
- Heated: `T += (68 - T) * (1 - exp(-1.5 * dt_h))`. Not heated: `T = T_out + (T - T_out) * exp(-k * dt_h)`.
- Vent blocked with power on and not tripped: `co += 60 * dt_h` (cap 400); trip furnace at `co >= 70`. Vent clear: `co -= 120 * dt_h` (floor 0); untrip when `co < 5`.
- Reported temp = true T + uniform(-0.3, 0.3). Round to 2 decimals.

**Readings posted each tick to `INGEST_URL` (one batch):**
`{time, home_id, temp_f, co_ppm, power_on, heating, outdoor_f, run_id}` where `time` is simulated UTC ISO.
- Skip homes with `battery == false` while their block's power is off (offline).

**Simulated time and run_id**
- Each run starts at `2026-11-08T02:00:00Z` (9:00 PM Buffalo) **[PLAN]**.
- `run_id = "r-" + wall-clock UTC "%Y%m%dT%H%M%S"` at reset **[PLAN]**.
- Fresh random generator from `SEED` on every reset so runs are identical.

**Pre-warm on reset**
- `prewarm = query param ?prewarm=N` if given, else `PREWARM_MINUTES`. If `prewarm > 0`: cut `PREWARM_BLOCK` at sim start, then advance `prewarm` storm minutes in 5-minute steps, **posting each step's batch** to `INGEST_URL` immediately (so the backend has history for k fit and charts). Then continue live ticking.

**Control endpoints (port 8001, internal only)**
| Route | Effect |
|---|---|
| `POST /cut_power/{block}` | block A–D off; 404 for unknown block |
| `POST /restore_power/{block}` | block on |
| `POST /block_vent/{home_id}` | vent blocked; 404 unknown home |
| `POST /clear_vent/{home_id}` | vent cleared |
| `POST /outdoor/{temp_f}` | float, range -30..60 else 400 |
| `POST /speed/{x}` | int storm s per real s, range 1..3600 else 400 |
| `POST /reset` (`?prewarm=N` optional) | new run as above; returns `{run_id, sim_now, speed, prewarm}` |
| `GET /state` | `{run_id, sim_now, outdoor_f, speed, blocks:[{block, power_on}]}` |
| `GET /homes` | static home info list |

On startup the simulator performs one reset automatically.

**Verify gate**
```bash
pip install -r sim/requirements.txt   # fastapi, uvicorn, httpx (same pins as api)
python sim/simulator.py --write-homes && python -c "import json;d=json.load(open('sim/homes.json'));print(len(d), d[12]['id'], d[12]['medical_needs'], d[12]['k_per_hour'])"
# expect: 40 H-13 oxygen 0.14
# run with a throwaway receiver to inspect batches:
python -c "
from fastapi import FastAPI, Request; import uvicorn, json
app=FastAPI(); n={'b':0}
@app.post('/api/ingest')
async def i(r:Request):
    d=await r.json(); n['b']+=1
    print(n['b'], len(d), sorted(d[0].keys()), d[0]['run_id'], d[0]['time']) if n['b']%5==1 else None
    return {}
uvicorn.run(app,port=8000,log_level='error')" &
INGEST_URL=http://localhost:8000/api/ingest python sim/simulator.py &
sleep 6
curl -s localhost:8001/state      # run_id r-..., speed 300, block B power_on false (pre-warm 80)
curl -s -X POST localhost:8001/reset?prewarm=0; sleep 3; curl -s localhost:8001/state   # all blocks on, new run_id
curl -s -X POST localhost:8001/speed/99999 -o /dev/null -w '%{http_code}\n'   # 400
kill %1 %2
```
Expected: first batches carry keys `co_ppm, heating, home_id, outdoor_f, power_on, run_id, temp_f, time`; pre-warm emits 16 batches quickly; two resets give two different run_ids but identical home data.

**Commit:** `backend: part 2 - simulator with run_id, heating, outdoor_f, speed, reset, prewarm, demo phones`

---

## Part 3 — DB pool, models, in-memory state, ingest, seed

**Goal:** readings flow from the simulator into TimescaleDB; `/api/health` reports it.

**Files:** `api/__init__.py`, `api/db.py`, `api/models.py`, `api/state.py`, `api/ingest.py`, `api/seed_homes.py`, `api/main.py` (initial), `api/tests/conftest.py`, `api/tests/test_ingest.py`

**`api/models.py`:** copy the PRD Pydantic models **verbatim** (Status, CallStatus, Outcome, Phase, Severity, Reading, Home, BlockState, SimState, SeriesPoint, Series, Event, AccuracyRow). `Home.k_source` is `Literal["learned","median"] | None`; `AccuracyRow.k_source` is `Literal["learned","global"]`.

**`api/db.py`:** `get_pool()` returns a lazily created asyncpg pool from `DATABASE_URL` (min 1, max 5). Works with `?sslmode=require` for Tiger Cloud.

**`api/state.py`:** singleton `State` with `run_id`, `sim_now`, `rows_ingested`, `homes_cache` (list of Home dicts), `episodes: set`, `events: deque(maxlen=20)`, `calls: dict[home_id -> {call_status, outcome}]`, `live_calls: int`, `saved_speed`, `last_pred_bucket`, `sim_state` (cached simulator /state). Methods: `reset(run_id)` clears everything except `rows_ingested` and records a `reset` event; `add_event(type, home_id, text, severity)` uses `sim_now` as `t`.

**`api/ingest.py`:** `POST /api/ingest` accepts `list[Reading]` or `{"readings": [...]}`.
- For `home_id == "H-REAL"`: set `time = state.sim_now` and `run_id = state.run_id` (skip the row if no `sim_now` yet).
- If a batch's `run_id` differs from `state.run_id`, call `state.reset(new_run_id)` first.
- Insert the whole batch in **one statement**: `INSERT INTO readings (...) SELECT * FROM unnest($1::timestamptz[], $2::text[], ...)`.
- Update `state.sim_now = max(time)` and `rows_ingested += n`. Return `{"inserted": n}`. Validation errors return 422 (FastAPI default).

**`api/seed_homes.py`:** `python -m api.seed_homes` upserts `sim/homes.json` into `homes` (`ON CONFLICT (id) DO UPDATE`). Phone numbers in DB come from `DEMO_PHONE_HOMES` env when present, else the JSON value.

**`api/main.py` (initial):** FastAPI app, CORS from `CORS_ORIGINS`, lifespan creates pool, include ingest router, `GET /api/health` → `{ok, sim_now, run_id, rows_ingested}`; if a `SELECT 1` fails return 503.

**Tests (`api/tests/conftest.py`):** session fixture runs `schema.sql`, seeds homes, sets `LOOP_ENABLED=0`; `client` fixture = `httpx.AsyncClient(transport=ASGITransport(app))`; each test uses a unique run_id (`r-test-<uuid>`) so tests never interfere. Reset the `State` singleton between tests.

**`test_ingest.py`:** `test_ingest_batch` (40 rows, one call, health count +40), `test_ingest_wrapped_body`, `test_real_sensor_restamp` (PRD: stored time = sim_now, run_id = current), `test_new_run_resets_state`, `test_bad_body_422`.

**Verify gate**
```bash
python -m venv .venv && . .venv/bin/activate && pip install -r api/requirements.txt
python -m api.seed_homes && psql "$DATABASE_URL" -c "select count(*) from homes;"   # 40
pytest -q api/tests/test_ingest.py                                                   # all pass
uvicorn api.main:app --port 8000 &  sleep 2
python sim/simulator.py &  sleep 5
curl -s localhost:8000/api/health; sleep 3; curl -s localhost:8000/api/health        # rows_ingested grows ~40 per second
psql "$DATABASE_URL" -c "select run_id, count(*) from readings group by 1 order by 1 desc limit 2;"
kill %1 %2
```

**Commit:** `backend: part 3 - db pool, models, state, ingest, seed, health`

---

## Part 4 — Prediction math (pure functions + tests)

**Goal:** the math everything else uses, proven by tests.

**File:** `api/predict.py` — implement `hours_to`, `estimate`, `status` **exactly** as in the PRD "Math and status" block. Add:
- `predict_curve(t_now, t_out, k, heating, hours=6, step_min=15) -> list[(minutes_ahead, temp)]`: heated → approach 68°F with rate 1.5/h; cooling with k → Newton; k None/≤0 → flat.
- `median(values)` helper.

**File:** `api/tests/test_predict.py` — PRD tests, checked to 2 decimals:
- `test_hours_to`: 64, 5, threshold 60, k 0.10 → **0.70**; threshold 50 → **2.71**.
- `test_hours_to_edges`: (48 vs 50) → 0.0; threshold 4 with t_out 5 → None; k = 0 → None.
- `test_status_precedence`: (CO 40 + leaving) critical; (leaving, 45°F) leaving; 45°F critical; 62°F h50 1.2 critical; 62°F h50 3.5 warning; 58°F heating on warning; 65°F heating off h50 6 cooling; 68°F heating on heated.
- `test_estimate`: estimate(60, 5, 0.1, 1.0) == 5 + 55·e^(−0.1) to 2 decimals.

**Verify gate**
```bash
pytest -q api/tests/test_predict.py      # all pass
python -c "from api.predict import hours_to; print(round(hours_to(64,5,60,0.10),2), round(hours_to(64,5,50,0.10),2))"   # 0.7 2.71
```

**Commit:** `backend: part 4 - prediction math and tests`

---

## Part 5 — SQL queries (k fit, latest state, accuracy)

**Goal:** all SQL in one module, each query proven against fixtures.

**File:** `api/queries.py`
- `K_FIT_SQL`: copy the PRD "k fit" query verbatim (`$1 = run_id`, `$2 = sim_now`).
- `LATEST_SQL`: latest reading per home for the run:
  ```sql
  SELECT DISTINCT ON (home_id) home_id, time, temp_f, co_ppm, power_on, heating, outdoor_f
  FROM readings WHERE run_id = $1
  ORDER BY home_id, time DESC;
  ```
- `SERIES_SQL`: readings for one home in the run with `time > $3 - interval '6 hours'`, ascending, limit 300.
- `INSERT_PRED_SQL`: insert into predictions via `unnest`.
- `ACCURACY_SQL`: copy the PRD "Accuracy" query verbatim. In Python, return **all four rows** (30/60 × learned/global), filling missing groups with `mae_f=None, n=0`.

**File:** `api/tests/test_queries.py`
- `test_k_fit`: 15 readings, `T = 5 + 59·e^(−0.1·h)`, every 5 storm minutes, heating false, outdoor 5 → **k = 0.10 ± 0.005, n = 10**.
- `test_k_fit_skips_heated_and_below_out`: heated rows and rows with T ≤ T_out + 0.5 are excluded.
- `test_latest`: returns one row per home, newest.
- `test_accuracy_interpolation`: readings 60.0°F at 01:00 and 58.0°F at 01:10 (heating false); prediction learned 59.0 for 01:04; prediction global 59.5 for 01:00 → **learned mae 0.20, global mae 0.50**; the other two rows have n = 0.

**Verify gate**
```bash
pytest -q api/tests/test_queries.py      # all pass
```

**Commit:** `backend: part 5 - sql queries with fixture tests`

---

## Part 6 — The loop, stubs, simulator control, homes and state endpoints

**Goal:** the 2-second brain: compute every home, trigger calls once per episode, log forecasts, serve `/api/homes`, `/api/state` and the sim proxy.

**`api/risk.py` (stub Harsh replaces):**
```python
def risk_score(home: dict, call: dict | None) -> int:
    base = {"heated": 0, "cooling": 20, "warning": 50, "critical": 80, "leaving": 0}[home["status"]]
    if home.get("medical_needs"): base += 15
    if home.get("age_band") == "75+": base += 10
    if not home.get("online", True): base += 10
    return min(100, base)
```

**`api/calls.py` (stub Harsh replaces):**
- `async def trigger_call(home_id: str, reason: str) -> None`: returns immediately; records `state.calls[home_id] = {"call_status": "done", "outcome": "none"}` and adds events `call_started` and `call_result` ("scripted stub").
- Router: `GET /api/calls/current` → `null`; `POST /api/calls/webhook` → 204.

**`api/simctl.py`:**
- `async sim_post(action, arg=None, params=None)` → POST to `SIM_URL`; network error → raise 502 `{"detail":"simulator unavailable"}`.
- `async sim_state()` → GET `SIM_URL/state`, cache in `state.sim_state`.
- `async set_live_call(active: bool)` **[PLAN counter]**: if active: `live_calls += 1`; on 0→1 save current speed and `sim_post("speed", LIVE_CALL_SPEEDUP)`. If not active: `live_calls = max(0, live_calls-1)`; on 1→0 restore `saved_speed`. Harsh's code calls this.

**`api/loop.py`:**
`async compute_homes()` (one cycle):
1. If no `run_id`/`sim_now`: return.
2. Load homes (cache static rows once), `LATEST_SQL`, `K_FIT_SQL`. Fitted k ≤ 0 → treat as not cooling. Homes without a fit use the median of fitted k (`k_source="median"`); if no fits at all, use 0.10.
3. For each home:
   - `online = (sim_now - last.time) <= 3 * current_speed seconds` **[PLAN]**.
   - If offline and not heating: `temp_f = estimate(last.temp_f, outdoor_f, k, hours_silent)`.
   - If heating: both countdowns None. Else `h60 = hours_to(temp, out, 60, k)`, `h50 = hours_to(temp, out, 50, k)`.
   - `outcome` and `call_status` from `state.calls` (defaults `none`).
   - `status = status(temp, co, heating, h50, outcome)`; `risk = risk_score(home_dict, call)`.
   - Build `Home` model fields exactly; `medical_needs` split into a list.
4. **Trigger (PRD logic, verbatim):** `should_call = (not heating and status in ("warning","critical")) or co >= 35`; if `should_call and id not in episodes` → add episode, add `threshold` event, `asyncio.create_task(trigger_call(id, reason=status))`. If `heating and co < 35` → `episodes.discard(id)`.
5. **Power and vent events:** compare each block's `power_on` and each home's CO crossing with the previous cycle; add `power_cut` / `power_restored` events (severity warning / info).
6. **Forecast logging:** bucket = floor(sim_now / 10 storm minutes). On a new bucket, for each **cooling, unheated** home insert 4 predictions: horizons 30 and 60 × k_source learned (its own k) and global (median k), `predicted_f = estimate(temp, out, k, horizon/60)`, `target_time = sim_now + horizon`.
7. Sort by risk desc, store in `state.homes_cache`. Refresh `sim_state()` (ignore errors).

`async run_loop()`: every `LOOP_SECONDS` if `LOOP_ENABLED`, run `compute_homes()`, catch and log exceptions so the loop never dies. Started in the app lifespan.

**`api/routes.py`:**
- `GET /api/homes` → `state.homes_cache` (sorted by risk).
- `GET /api/state` → `SimState` from cached simulator state + `run_id`, `sim_now`, `live_call = state.live_calls > 0`.
- `POST /api/sim/{action}/{arg}` for `cut_power|restore_power|block_vent|clear_vent|outdoor|speed`; unknown action or invalid arg → 400 `{"detail": "unknown action foo"}`. After success add the matching event (`power_cut`, `vent_blocked`, …), refresh sim state, and run `compute_homes()` once so the dashboard updates fast.
- `POST /api/sim/reset` (optional `?prewarm=N`) → proxy; then `state.reset(new_run_id)`.

**Tests (`api/tests/test_loop.py`)** — monkeypatch `api.loop.trigger_call` with a counter and stub `sim_state`:
- `test_trigger_once`: home at warning, heating off, 3 cycles → called once.
- `test_no_repeat_call`: after a call, heating returns, home at 55°F warming → no second call; episode cleared.
- `test_co_trigger`: heating off by blocked vent, CO 40, 66°F → one call.
- `test_live_call_counter`: two `set_live_call(True)`, one `False` → still slowed; second `False` → speed restored to the saved value.
- `test_offline_threshold`: last reading 10 storm minutes old at speed 300 → online; 20 minutes old → offline and `temp_f` is an estimate.

**`scripts/smoke.sh`:** starts nothing itself; assumes api (8000) and sim (8001) are running. Posts `/api/sim/reset` (default prewarm), polls `/api/homes` every 2 s for up to 40 s, passes when any Block B home has status `warning` or `critical` and `/api/health` `rows_ingested` increased. Exit code 0/1.

**Verify gate**
```bash
pytest -q api/tests                      # everything so far passes
uvicorn api.main:app --port 8000 &  python sim/simulator.py &  sleep 4
bash scripts/smoke.sh && echo SMOKE_OK
curl -s localhost:8000/api/state
curl -s localhost:8000/api/homes | python -c "import sys,json; h=json.load(sys.stdin); print(len(h), h[0]['id'], h[0]['status'], h[0]['risk'], h[0]['hours_to_50'])"
curl -s -X POST localhost:8000/api/sim/block_vent/H-27; sleep 12
curl -s localhost:8000/api/homes | python -c "import sys,json; print([ (h['id'],h['status'],h['co_ppm']) for h in json.load(sys.stdin) if h['id']=='H-27'])"   # CO rising, critical once >= 35
curl -s -X POST localhost:8000/api/sim/foo/1 -o /dev/null -w '%{http_code}\n'   # 400
kill %1 %2
```

**Commit:** `backend: part 6 - risk loop, call trigger, stubs, sim proxy, homes and state api`

---

## Part 7 — Series, events, accuracy, reset isolation, offline estimates, dev compose

**Goal:** the remaining read endpoints and full local stack in Docker.

**`api/routes.py` additions**
- `GET /api/homes/{id}/series` → `Series`: `actual` = SERIES_SQL points (`est=false`); if the home is offline, append estimated points every 15 storm minutes from the last reading to `sim_now` (`est=true`); `predicted` = `predict_curve` from now, 6 storm hours, 15-minute steps, with `t = sim_now + minutes`. Unknown id → 404 `{"detail": "unknown home H-99"}`.
- `GET /api/events` → `state.events`, newest first, max 20.
- `GET /api/accuracy` → always 4 rows (Part 5).

**Docker for dev**
- `api/Dockerfile`: python:3.12-slim, install requirements, `CMD ["uvicorn","api.main:app","--host","0.0.0.0","--port","8000"]` (one worker). Build context = repo root.
- `sim/Dockerfile`: python:3.12-slim, `CMD ["python","sim/simulator.py"]`.
- Add `api` and `sim` services to `docker-compose.dev.yml` with `env_file: .env`, `DATABASE_URL=postgresql://postgres:postgres@db:5432/savel`, `SIM_URL=http://sim:8001`, `INGEST_URL=http://api:8000/api/ingest`; `api` depends on db healthy; a one-shot `seed` service or api startup step runs `python -m api.seed_homes`. Expose 8000 (api) and 8001 (sim) in dev only.

**Tests (`api/tests/test_api.py`)**
- `test_reset_isolation`: rows in run A, reset to run B, rows in B → `/api/homes`, `/api/events`, `/api/accuracy` show only run B.
- `test_errors`: unknown home 404; unknown sim action 400; bad ingest 422.
- `test_series_shape`: actual ascending with `est` flags; predicted 25 points (0..6 h every 15 min).
- `test_accuracy_always_four_rows`.

**Verify gate**
```bash
pytest -q api/tests                                                  # all pass
docker compose -f docker-compose.dev.yml up -d --build
sleep 15 && bash scripts/smoke.sh && echo SMOKE_OK
curl -s localhost:8000/api/events | head -c 400; echo
curl -s localhost:8000/api/homes/H-13/series | python -c "import sys,json; s=json.load(sys.stdin); print(len(s['actual']), len(s['predicted']))"
sleep 60 && curl -s localhost:8000/api/accuracy                       # n > 0 for learned and global after ~1 min at 300x
curl -s -X POST localhost:8000/api/sim/reset && sleep 3 && curl -s localhost:8000/api/state   # new run_id
```

**Commit:** `backend: part 7 - series, events, accuracy, reset isolation, offline estimates, dev compose`

---

## Part 8 — Production deploy (Vultr + Caddy + Tiger Cloud + domain)

**Goal:** the live HTTPS domain the demo and sponsor prizes need.

**HUMAN prerequisites (stop and ask Piyush for these):**
1. Tiger Cloud service in AWS us-east-1 → its `DATABASE_URL` (with `?sslmode=require`).
2. Vultr VM: Ubuntu 24.04, 2 GB, New York, Docker installed, firewall open 22/80/443 → its IP and SSH access.
3. GoDaddy Registry domain (e.g. `savel.<tld>`) → A record to the VM IP, low TTL.
4. Real team phone numbers for `DEMO_PHONE_HOMES` (from Harsh) — set only in the VM's `.env`.

**Files**
- `deploy/docker-compose.yml`: services `api`, `sim`, `caddy` (no db; uses Tiger Cloud). `caddy` image `caddy:2`, ports 80/443, volumes `./Caddyfile:/etc/caddy/Caddyfile`, `../web/dist:/srv/web:ro`, `caddy_data`, `caddy_config`. Only caddy publishes ports.
- `deploy/Caddyfile`:
  ```
  {$DOMAIN} {
      encode gzip
      handle /api/* {
          reverse_proxy api:8000
      }
      handle {
          root * /srv/web
          try_files {path} /index.html
          file_server
      }
  }
  ```

**Steps**
1. Apply schema and seed to Tiger Cloud from your laptop: `psql "$TIGER_URL" -f api/schema.sql` and `DATABASE_URL=$TIGER_URL python -m api.seed_homes`.
2. On the VM: clone the repo, checkout `backend`, create `deploy/.env` from `.env.example` with real values (`DATABASE_URL`, `DOMAIN`, `DEMO_PHONE_HOMES`, `CORS_ORIGINS=https://<domain>`).
3. If `web/dist` does not exist yet, create `web/dist/index.html` with a placeholder ("SAVEL dashboard coming soon") **on the VM only; do not commit it**.
4. `cd deploy && docker compose up -d --build`.
5. Until DNS resolves: `cloudflared tunnel --url http://localhost:80` gives Harsh a temporary HTTPS URL for the webhook.

**Verify gate**
```bash
curl -s https://<domain>/api/health          # ok true, rows_ingested rising
curl -s https://<domain>/api/state           # speed 300, run_id
curl -s -X POST https://<domain>/api/sim/reset && sleep 40 && curl -s https://<domain>/api/homes | head -c 300
curl -sI https://<domain>/ | head -1         # 200 from Caddy
```

**Commit:** `backend: part 8 - production compose and caddyfile` (no secrets; `deploy/.env` stays on the VM only).

---

## Part 9 — Hardening, handoff, demo rehearsal

**Goal:** the backend survives three demo runs and the team can integrate without asking Piyush.

**Steps**
1. **README.md** (backend section): one-command local run (`cp .env.example .env && docker compose -f docker-compose.dev.yml up -d --build`), test command, smoke command, deploy steps, every env var, and the API list with one example response each (copy from the PRD).
2. **Integration notes for Harsh** in README: replace `api/risk.py` and `api/calls.py` keeping signatures `risk_score(home, call) -> int` and `async trigger_call(home_id, reason)`; call `simctl.set_live_call(True/False)` around live calls; write call status and outcome into `state.calls[home_id]` using the PRD enums; `GET /api/calls/current` must return the PRD shape `{home_id, phase, source, language, transcript[], extracted}`; the webhook URL is `https://<domain>/api/calls/webhook`.
3. **Sample JSON for Huzaifa:** save live responses to `docs/samples/` (`homes.json`, `state.json`, `events.json`, `accuracy.json`, `series-H-13.json`).
4. **Resilience checks:** stop the simulator container → `/api/sim/*` returns 502 and `/api/homes` keeps serving the last cache; start it again → recovers without restarting api. Kill the DB connection briefly → `/api/health` returns 503, loop logs and continues.
5. **Timing check:** add a log line with each loop cycle's duration; confirm under 1 s for 40 homes on the VM.
6. **Three-run rehearsal:** reset → cut/observe → block vent → reset, three times. Same homes cross thresholds in the same order each run.
7. **Secret scan before the repo is public:** `git grep -nE '(\+1[0-9]{10}|sk-|AIza|postgres://[^@]+:[^@]+@[a-z])'` returns nothing except `.env.example` placeholders.
8. Open a PR `backend → main` titled "SAVEL backend" summarizing parts 0–9; request review from Harsh.

**Verify gate**
```bash
pytest -q api/tests && bash scripts/smoke.sh && echo ALL_OK
docker compose -f docker-compose.dev.yml stop sim && curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8000/api/sim/cut_power/A   # 502
curl -s localhost:8000/api/homes | head -c 100; echo                     # still serves cache
docker compose -f docker-compose.dev.yml start sim && sleep 5 && curl -s localhost:8000/api/health
git grep -nE '(\+1[0-9]{10}|sk-|AIza)' -- . ':!.env.example' || echo NO_SECRETS
```

**Commit:** `backend: part 9 - readme, samples, resilience, rehearsal` → push → open PR.

---

## Timeline (Saturday Nov 7 → Sunday Nov 8)

| By | Parts done | Team checkpoint |
|---|---|---|
| 5:15 PM | 0, 1, 2, 3 | Readings land in TimescaleDB; simulator has run_id, heating, outdoor_f, speed, reset |
| 7:00 PM | 4, 5, 6 | Cutting Block B shows warnings within 40 s in `/api/homes`; Huzaifa switches to the live API |
| 9:30 PM | 7 | Full dev stack in Docker; accuracy returns numbers |
| 11:00 PM | 8 | Live HTTPS domain; Harsh's webhook URL works; repo public |
| 3:00 AM | 9 | Rehearsed three times; PR open |

If behind, cut in this order: offline estimates (Part 7, keep `online` flag), then the battery flag (Part 2). Never cut `/api/homes`, countdowns, the call trigger or `/api/accuracy`.

---

## Definition of done (backend)

- `pytest -q api/tests` passes; `scripts/smoke.sh` passes locally and against the live domain.
- Every endpoint in the PRD returns the exact model shapes; enums match the PRD.
- Reset gives a new run_id and identical behavior three times in a row.
- A Block B home reaches warning within 40 s at 300×; a live call drops speed to 30× and restores it after, including overlapping calls.
- `/api/accuracy` returns all four rows with real numbers after a minute of cooling.
- Live HTTPS domain serves `/api/*` and the dashboard; no secrets in the repo; `backend` merged or PR open.
