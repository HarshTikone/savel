# SAVEL backend progress

## Checklist
- [x] Part 0 - branch, rules, progress tracker
- [x] Part 1 - config, schema, local timescaledb
- [x] Part 2 - simulator
- [x] Part 3 - db pool, models, state, ingest, seed, health
- [x] Part 4 - prediction math and tests
- [x] Part 5 - sql queries with fixture tests
- [x] Part 6 - risk loop, call trigger, stubs, sim proxy, homes and state api
- [x] Part 7 - series, events, accuracy, reset isolation, offline estimates, dev compose
- [x] Part 8 - production compose and caddyfile (files + local rehearsal; live domain pending HUMAN)
- [x] Part 9 - readme, samples, resilience, rehearsal

## Verify output

### Part 0
```
On branch backend
OK
GITIGNORE_OK
```

### Part 1
```
$ bash scripts/psql.sh -c '\dt'
 public | calls       | table | postgres
 public | homes       | table | postgres
 public | predictions | table | postgres
 public | readings    | table | postgres
(4 rows)
$ ... timescaledb_information.hypertables
 readings
$ bash scripts/psql.sh -v ON_ERROR_STOP=1 -f - < api/schema.sql
(all NOTICE ... already exists, skipping)
IDEMPOTENT_OK
```

### Part 2
```
$ python sim/simulator.py --write-homes && python -c "...len, d[12]..."
40 H-13 oxygen 0.14          (11 homes without battery)
$ curl localhost:8001/state  (after startup, prewarm 80)
{"run_id":"r-20261107T215325","sim_now":"2026-11-08T02:30:00Z","outdoor_f":5.0,"speed":300,"blocks":[A true, B false, C true, D true]}
$ curl -X POST localhost:8001/reset?prewarm=0; sleep 3; curl localhost:8001/state
{"run_id":"r-20261107T215331","sim_now":"2026-11-08T02:00:00Z","speed":300,"prewarm":0}
{"run_id":"r-20261107T215331","sim_now":"2026-11-08T02:15:00Z",...all blocks power_on true}
speed/99999 -> 400 ; cut_power/Z -> 404 ; outdoor/abc -> 400
receiver: batches 1..16 (pre-warm, 00:45Z..02:00Z, 5-min steps, sent in ~10 ms) then 1/s live
1 38 ['co_ppm','heating','home_id','outdoor_f','power_on','run_id','temp_f','time'] r-20261107T215325 2026-11-08T00:45:00Z
16 38 [...] r-20261107T215325 2026-11-08T02:00:00Z
```

### Part 3
```
$ python -m api.seed_homes && psql -c "select count(*) from homes;"
seeded 40 homes / count 40
$ pytest -q api/tests/test_ingest.py
6 passed in 0.28s
$ uvicorn api.main:app & python sim/simulator.py & ; curl /api/health; sleep 3; curl /api/health
{"ok":true,"sim_now":"2026-11-08T02:25:00+00:00","run_id":"r-20261107T215546","rows_ingested":798}
{"ok":true,"sim_now":"2026-11-08T02:40:00+00:00","run_id":"r-20261107T215546","rows_ingested":912}
(+38/tick: 40 homes minus 2 battery-less Block B homes offline during the pre-warm outage)
$ select run_id, count(*) from readings ...
 r-20261107T215546 |   912
```

### Part 4
```
$ pytest -q api/tests/test_predict.py
6 passed in 0.05s
$ python -c "...hours_to(64,5,60,0.10), hours_to(64,5,50,0.10)"
0.7 2.71
```

### Part 5
```
$ pytest -q api/tests/test_queries.py
4 passed (test_k_fit k=0.10±0.005 n=10; skips heated/below-out; latest; accuracy learned 0.20 global 0.50, 60-min rows n=0)
$ pytest -q api/tests
16 passed in 0.33s
```

### Part 6
```
$ pytest -q api/tests
21 passed in 0.41s
$ bash scripts/smoke.sh
PASS after 2s: Block B at risk [H-16:critical,H-13:critical,H-14:critical,H-12:critical,H-17:warning,H-20:warning,H-18:warning]; rows_ingested 1368 -> 1444
SMOKE_OK
$ curl /api/state
{"run_id":"r-20261107T215944","sim_now":"2026-11-08T02:10:00+00:00","outdoor_f":5.0,"speed":300,"live_call":false,"blocks":[A on, B off, C on, D on]}
$ curl /api/homes  (len, top id, status, risk, hours_to_50)
40 H-16 critical 100 0.96
  H-13 B critical 55.66 online k=0.1375 learned h60=0.0 h50=0.86 risk 95 call done
  H-17 B warning 60.66 OFFLINE k=0.0875 median (never reported: no battery) risk 85
$ POST /api/sim/block_vent/H-27; sleep 12
[('H-27', 'critical', 60.0 ppm, heating True)]
$ POST /api/sim/foo/1 -> 400 {"detail":"unknown action foo"}
```

### Part 7
```
$ pytest -q api/tests
25 passed in 0.53s
$ docker compose -f docker-compose.dev.yml up -d --build; sleep 15; bash scripts/smoke.sh
PASS after 2s: Block B at risk [H-16:critical,H-13:critical,H-12:critical,H-14:critical,H-17:warning,H-20:warning]; rows_ingested 2052 -> 2128
SMOKE_OK
$ curl /api/events  -> newest first: call_result/call_started (stub) events ...
$ curl /api/homes/H-13/series -> 18 actual, 25 predicted
$ sleep 60; curl /api/accuracy
[{"horizon_min":30,"k_source":"learned","mae_f":0.25,"n":224},{"horizon_min":30,"k_source":"global","mae_f":0.81,"n":224},
 {"horizon_min":60,"k_source":"learned","mae_f":0.3,"n":200},{"horizon_min":60,"k_source":"global","mae_f":1.59,"n":200}]
$ POST /api/sim/reset; sleep 3; curl /api/state
{"run_id":"r-20261107T220304","sim_now":"2026-11-08T02:15:00+00:00",...,"speed":300,"blocks":[... B false ...]}
api logs: seeded 40 homes; loop cycle took 17-22 ms (40 homes)
```

### Part 8
```
LOCAL rehearsal of deploy/docker-compose.yml (DOMAIN=:80, DATABASE_URL -> local TimescaleDB via host.docker.internal):
$ curl localhost/api/health
{"ok":true,"sim_now":"2026-11-08T03:00:00+00:00","run_id":"r-20261107T220348","rows_ingested":1064}
$ curl localhost/api/state     -> speed 300, run_id, Block B off
$ POST /api/sim/reset; curl /api/homes -> H-16 critical risk 100 ...
$ curl -I localhost/           -> HTTP/1.1 200 OK (Caddy, placeholder web/dist)
$ curl localhost/some/spa/route -> index.html (SPA fallback)
$ curl localhost:8001/state    -> 000 (simulator not published)
$ BASE=http://localhost bash scripts/smoke.sh -> PASS after 2s
LIVE gate (https://<domain>) PENDING HUMAN: Tiger Cloud URL, Vultr VM, GoDaddy domain + A record, team phone numbers.
```

### Part 9
```
$ pytest -q api/tests && bash scripts/smoke.sh && echo ALL_OK
25 passed / PASS after 2s / ALL_OK
$ docker compose stop sim; POST /api/sim/cut_power/A
502 {"detail":"simulator unavailable"}   ; /api/homes still serves cache ; /api/state 200 (cached)
$ docker compose start sim; sleep 5; curl /api/health
{"ok":true,...,"run_id":"r-20261107T220454",...}   (recovered, no api restart)
$ docker compose stop db; curl /api/health -> 503 {"ok":false,...}; loop logs "loop cycle failed" and continues
$ docker compose start db -> /api/health 200, rows_ingested rising again
Timing: "loop cycle N took 17-22 ms (40 homes)" (laptop; re-check on VM)
$ python3 scripts/rehearse.py
run 1 r-20261107T220526: at-risk order ['H-12','H-13','H-14','H-16','H-17','H-18','H-20','H-11','H-19','H-15','H-27']; H-27 critical CO 70.0
run 2 r-20261107T220602: (identical)
run 3 r-20261107T220639: (identical)
SAME_BEHAVIOR
$ git grep -nE '(\+1[0-9]{10}|sk-|AIza|postgres://...)' -- . ':!.env.example'
only hits: placeholder/regex text inside docs/SAVEL_Backend_Implementation_Plan.md -> no secrets
PENDING HUMAN: push (403 for shaw-piyush on HarshTikone/savel), PR backend -> main, VM timing check.
```

## Decisions made during build
- PRD v4 transcribed from the PDF into docs/backend-prd.md (code, schema, SQL verbatim).
- Local Python is 3.14 (no asyncpg 0.30.0 wheel); dev venv uses Python 3.12 via `uv venv -p 3.12`. Dockerfiles use python:3.12-slim.
- `psql` is not installed on the dev laptop; verify gates run psql inside the db container (`docker compose -f docker-compose.dev.yml exec db psql -U postgres -d savel`).
- schema.sql adds `CREATE EXTENSION IF NOT EXISTS timescaledb;` as its first line so it also works on a plain database; otherwise verbatim PRD.
- .env.example keeps Harsh's voice/AI keys (empty) in a separate section.
- Added scripts/psql.sh (psql inside the dev db container).
- Reset opens at 2026-11-08T02:00Z (9:00 PM) per PRD FR15: pre-warm history covers [02:00 - prewarm, 02:00], so live ticking starts at 9:00 PM with Block B already prewarm minutes into its outage.
- homes.json phones use dashed fakes (+1-716-555-01NN) and the demo placeholder +1-000-000-0000 so the Part 9 secret-scan regex never matches committed data; real numbers come only from DEMO_PHONE_HOMES at runtime.
- Simulator posts each batch while holding its lock, so no stale old-run batch can arrive after a reset's new-run batches.
- Blocked vent with a tripped furnace holds CO steady (no combustion, no clearing) until the vent is cleared.
- Same-second resets get a -2, -3 suffix on run_id so it stays unique.
- State.reset(run_id) is idempotent per run_id (the sim's pre-warm batches already switch the run before the /api/sim/reset proxy returns, and a second reset must not wipe sim_now).
- Reset event time = first timestamp of the new run's first batch (or the sim's reported sim_now on proxy reset).
- Test isolation: each test gets a fresh State and closes the asyncpg pool (pool is bound to the test's event loop); unique r-test-<uuid> run ids.
- No python-dotenv (not in the PRD pins): code defaults match .env.example for local runs; Docker passes .env via env_file.
- predict_curve heated branch: T(h) = 68 + (T_now - 68)·e^(-1.5h), same model as the simulator.
- K_FIT_SQL: the only edit to the PRD SQL is `$2::timestamptz` (asyncpg otherwise infers `$2 - interval` as interval and fails). ACCURACY_SQL is verbatim.
- queries.py also holds the small async fetch helpers (fetch_k_fit, fetch_latest, fetch_accuracy) so all SQL stays in one module.
- Homes with no reading at all in the current run (battery-less homes whose block was dark since the run began, e.g. H-17/H-20 after pre-warm) are listed offline with temp estimated from 68°F at the run's start, so all 40 homes appear and silence raises concern.
- k_est/k_source are None until any home has a fit (PRD model); the countdown math then uses k=0.10 internally.
- Forecasts are logged only for online, unheated homes with their own positive learned fit (so learned vs global differ).
- Power events come from both the proxy (immediate) and the loop's block-state diff (catches pre-warm and direct sim changes); the proxy updates prev_power so they never double-log.
- The sim proxy maps simulator 4xx (unknown block/home) to 400; validation of args happens before proxying.
- Loop logs its cycle duration every 15th cycle.
- api container seeds homes on startup (idempotent upsert, real phones from DEMO_PHONE_HOMES env) before starting one uvicorn worker.
- Dev compose: sim waits for api healthy so the pre-warm history is ingested; env_file .env is optional.
- Series for a home that never reported returns actual [] and a 25-point predicted curve from its estimate.
- Part 8 files done and rehearsed locally; the live-domain gate waits on HUMAN prerequisites (Tiger Cloud, Vultr VM, domain, phones).
- Production api seeds Tiger Cloud on container start, so step 1 (seed from laptop) is optional; schema.sql must still be applied once with psql.
- Caddy DOMAIN is required (compose fails fast if unset).
- Added scripts/rehearse.py (3-run determinism check) used for the rehearsal step.
- Sample responses in docs/samples/ were captured 20 s after a reset with H-27's vent blocked for 10 s.
- Deploy fix (found on first VM boot): a fresh TimescaleDB restarts after its init scripts, so a socket-based `pg_isready` passed early and the api's seed step failed (0 homes). Seed now retries for ~60 s and the dev healthcheck uses TCP (`-h 127.0.0.1`). httpx request logging silenced in the api.
