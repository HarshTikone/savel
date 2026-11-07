# SAVEL

Heat-loss early warning for homes during power outages. Sensors stream indoor temperature and CO, the backend predicts when each home will cross 60°F and 50°F (Newton's law of cooling), an ElevenLabs voice agent checks in on at-risk residents, Gemini extracts structured results from the call, and responders get a ranked map and briefings.

## Team
- Harsh: AI + voice + pitch (ElevenLabs, Twilio, webhook, Gemini, risk rules)
- Piyush: backend + data + infra (FastAPI, Tiger Data, simulator, prediction API, Vultr, Caddy, domain)
- Huzaifa: frontend + demo (React, Vite, Leaflet, Recharts, call panel, Devpost visuals)

## Layout
```
api/        FastAPI backend (ingest, 2 s risk loop, homes/series/events/accuracy, sim proxy)
sim/        simulator.py (40 synthetic homes) + homes.json
web/        React + Vite dashboard (Huzaifa)
deploy/     production docker-compose.yml + Caddyfile (Vultr VM)
scripts/    smoke.sh, rehearse.py, psql.sh
docs/       backend-prd.md (spec), backend-progress.md, samples/ (live JSON responses)
```

## Backend

### Run locally (one command)
```bash
cp .env.example .env && docker compose -f docker-compose.dev.yml up -d --build
```
This starts TimescaleDB (schema auto-applied), the API on `:8000` (seeds homes on start) and the simulator on `:8001`. The simulator resets on start: a new `run_id`, 9:00 PM simulated time, Block B already 80 storm minutes into an outage, 300× speed.

```bash
curl localhost:8000/api/homes      # ranked homes
bash scripts/smoke.sh              # end-to-end check (Block B reaches warning within 40 s)
python3 scripts/rehearse.py        # 3 demo runs; prints SAME_BEHAVIOR if identical
```

### Tests
```bash
uv venv -p 3.12 .venv && uv pip install -p .venv -r api/requirements.txt   # or python3.12 -m venv
docker compose -f docker-compose.dev.yml up -d db
.venv/bin/pytest -q api/tests
```
Without Docker for api/sim: `.venv/bin/uvicorn api.main:app --port 8000` and `.venv/bin/python sim/simulator.py` (run `python -m api.seed_homes` once first).

### Configuration
All settings are environment variables; `.env.example` lists them. `.env` is never committed.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/savel` | Local TimescaleDB or Tiger Cloud (`?sslmode=require`) |
| `SIM_URL` | `http://localhost:8001` | Where the API reaches the simulator |
| `INGEST_URL` | `http://localhost:8000/api/ingest` | Where the simulator posts readings |
| `SPEEDUP` | `300` | Storm seconds per real second (1 tick = 5 storm minutes) |
| `LIVE_CALL_SPEEDUP` | `30` | Speed while a live call is in progress |
| `SEED` | `42` | Random seed reused on every reset |
| `PREWARM_BLOCK` | `B` | Block that starts in an outage after reset |
| `PREWARM_MINUTES` | `80` | How far into that outage reset starts (`POST /api/sim/reset?prewarm=N` overrides; 0 = clean start) |
| `OUTDOOR_F` | `5` | Starting outdoor temperature |
| `DEMO_PHONE_HOMES` | `H-13:+1…,H-16:+1…,H-27:+1…` | Team phones mapped to homes (real numbers only in the runtime `.env`) |
| `LOOP_SECONDS` | `2` | Risk loop interval |
| `LOOP_ENABLED` | `1` | Set `0` to disable the loop (tests) |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `DOMAIN` | `savel.example` | Caddy site address in production |

### API (all under `/api`)
Full contract and models: [docs/backend-prd.md](docs/backend-prd.md) and [api/models.py](api/models.py). Live sample responses: [docs/samples/](docs/samples/).

| Method and path | Returns |
|---|---|
| `GET /api/health` | `{ok, sim_now, run_id, rows_ingested}`; 503 when the DB is unreachable |
| `GET /api/state` | `{run_id, sim_now, outdoor_f, speed, live_call, blocks:[{block, power_on}]}` |
| `POST /api/ingest` | body `[Reading]` or `{readings:[...]}` → `{inserted}`; `H-REAL` restamped with `sim_now` |
| `GET /api/homes` | `[Home]` sorted by risk |
| `GET /api/homes/{id}/series` | `{actual:[{t,temp_f,est}], predicted:[{t,temp_f,est}]}` (6 storm hours, 15-min steps) |
| `GET /api/events` | latest 20 `{t, type, home_id, text, severity}`, newest first |
| `GET /api/accuracy` | always 4 rows `{horizon_min, k_source, mae_f, n}` |
| `GET /api/calls/current` | Harsh: `{home_id, phase, source, language, transcript[], extracted}` (stub returns `null`) |
| `POST /api/calls/webhook` | Harsh: ElevenLabs post-call webhook (stub returns 204) |
| `POST /api/sim/{action}/{arg}` | `cut_power/{A-D}`, `restore_power/{A-D}`, `block_vent/{H-xx}`, `clear_vent/{H-xx}`, `outdoor/{-30..60}`, `speed/{1..3600}` |
| `POST /api/sim/reset` | new run (optional `?prewarm=N`) → `{run_id, sim_now, speed, prewarm}` |

Errors: unknown home → 404 `{"detail":"unknown home H-99"}`; unknown sim action/bad arg → 400 `{"detail":"unknown action foo"}`; bad ingest → 422; simulator down → 502 `{"detail":"simulator unavailable"}`.

Example responses:
```jsonc
// GET /api/homes (one item)
{"id":"H-16","block":"B","lat":42.9541,"lon":-78.84733,"temp_f":56.24,"co_ppm":0.0,"power_on":false,
 "heating":false,"online":true,"k_est":0.1351,"k_source":"learned","hours_to_60":0.0,"hours_to_50":0.96,
 "status":"critical","risk":100,"call_status":"done","outcome":"none","age_band":"75+",
 "medical_needs":["mobility"],"language":"es"}
// GET /api/state
{"run_id":"r-20261107T220304","sim_now":"2026-11-08T02:15:00+00:00","outdoor_f":5.0,"speed":300,
 "live_call":false,"blocks":[{"block":"A","power_on":true},{"block":"B","power_on":false},
 {"block":"C","power_on":true},{"block":"D","power_on":true}]}
// GET /api/events (one item)
{"t":"2026-11-08T02:00:00+00:00","type":"threshold","home_id":"H-13","text":"H-13 reached critical","severity":"critical"}
// GET /api/accuracy (measured on a local run)
[{"horizon_min":30,"k_source":"learned","mae_f":0.25,"n":224},{"horizon_min":30,"k_source":"global","mae_f":0.81,"n":224},
 {"horizon_min":60,"k_source":"learned","mae_f":0.3,"n":200},{"horizon_min":60,"k_source":"global","mae_f":1.59,"n":200}]
```

### Integration notes for Harsh
- Replace `api/risk.py` and `api/calls.py`, keeping the signatures: `risk_score(home: dict, call: dict | None) -> int` (0–100, deterministic) and `async def trigger_call(home_id: str, reason: str) -> None` (must return immediately; run the call in a background task). Keep the `router` in `calls.py` exposing `GET /api/calls/current` and `POST /api/calls/webhook`.
- The loop calls `trigger_call` once per episode (heating off and status warning/critical, or CO ≥ 35); `reason` is the status.
- Around a **live** call: `from api.simctl import set_live_call` → `await set_live_call(True)` at start, `await set_live_call(False)` at end. It is counted, so overlapping calls are safe; speed drops to 30× and the previous speed is restored after the last call ends.
- Write call progress into `state.calls[home_id] = {"call_status": ..., "outcome": ...}` (`from api.state import state`) using the PRD enums: call_status `none|queued|ringing|in_call|done|no_answer|unreachable`; outcome `none|ok|needs_help|medical|leaving|unreachable`. Outcome `leaving` sets the home's status to `leaving`. Add log lines with `state.add_event("call_started"|"call_result", home_id, text, "info"|"warning"|"critical")`.
- `GET /api/calls/current` must return `{home_id, phase, source, language, transcript[], extracted}` (phase `ringing|in_call|extracting|done|no_answer`, source `live|scripted`) or `null`.
- Use simulated time for anything stored: `state.sim_now`, `state.run_id` (the `calls` table has `run_id` and `started_at`).
- Webhook URL: `https://<domain>/api/calls/webhook`.

### Deploy (Vultr + Caddy + Tiger Cloud)
1. Apply the schema once: `psql "$TIGER_URL" -f api/schema.sql` (the api container seeds `homes` on start; `DATABASE_URL=$TIGER_URL python -m api.seed_homes` also works).
2. On the VM (Ubuntu 24.04, Docker, firewall 22/80/443): `git clone … && git checkout backend`.
3. Create `deploy/.env` from `.env.example` with real `DATABASE_URL` (Tiger, `?sslmode=require`), `DOMAIN`, `DEMO_PHONE_HOMES`, `CORS_ORIGINS=https://<domain>` and Harsh's keys. Never commit it.
4. Put the dashboard build in `web/dist` (if missing, create a placeholder `web/dist/index.html` on the VM only).
5. `cd deploy && docker compose up -d --build`. Caddy gets the certificate once the A record resolves. Only Caddy publishes ports.
6. Check: `BASE=https://<domain> bash scripts/smoke.sh`.
7. Until DNS resolves: `cloudflared tunnel --url http://localhost:80` gives a temporary HTTPS URL for the webhook.

### Guardrails
One uvicorn worker (state is in memory); no wall-clock time in logic (use `sim_now`); every query filters by `run_id`; never change API shapes or enums; risk is deterministic; no secrets in git. See [CLAUDE.md](CLAUDE.md).
