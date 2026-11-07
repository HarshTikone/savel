# SAVEL backend progress

## Checklist
- [x] Part 0 - branch, rules, progress tracker
- [x] Part 1 - config, schema, local timescaledb
- [x] Part 2 - simulator
- [ ] Part 3 - db pool, models, state, ingest, seed, health
- [ ] Part 4 - prediction math and tests
- [ ] Part 5 - sql queries with fixture tests
- [ ] Part 6 - risk loop, call trigger, stubs, sim proxy, homes and state api
- [ ] Part 7 - series, events, accuracy, reset isolation, offline estimates, dev compose
- [ ] Part 8 - production compose and caddyfile
- [ ] Part 9 - readme, samples, resilience, rehearsal

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
