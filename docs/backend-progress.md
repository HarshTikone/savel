# SAVEL backend progress

## Checklist
- [x] Part 0 - branch, rules, progress tracker
- [x] Part 1 - config, schema, local timescaledb
- [ ] Part 2 - simulator
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

## Decisions made during build
- PRD v4 transcribed from the PDF into docs/backend-prd.md (code, schema, SQL verbatim).
- Local Python is 3.14 (no asyncpg 0.30.0 wheel); dev venv uses Python 3.12 via `uv venv -p 3.12`. Dockerfiles use python:3.12-slim.
- `psql` is not installed on the dev laptop; verify gates run psql inside the db container (`docker compose -f docker-compose.dev.yml exec db psql -U postgres -d savel`).
- schema.sql adds `CREATE EXTENSION IF NOT EXISTS timescaledb;` as its first line so it also works on a plain database; otherwise verbatim PRD.
- .env.example keeps Harsh's voice/AI keys (empty) in a separate section.
- Added scripts/psql.sh (psql inside the dev db container).
