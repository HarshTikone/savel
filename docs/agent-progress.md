# Agent build progress (Harsh, branch `harsh-agent`)

Plan: docs/SAVEL_Agent_Implementation_Plan_v2.md (kept in the team project). Each part ends with a verify gate and a commit.

## Reality check (Part 0)
- Real repo, `main` at 4f263bf. `api/risk.py` and `api/calls.py` were Piyush's stubs; the PRD names Harsh as owner, and Harsh asked for them to be replaced. Signatures kept.
- Loop contract (api/loop.py): `risk_score(home, call)` per home each cycle; `_spawn(trigger_call(hid, reason=st))` once per episode.
- State: `state.calls[home_id] = {"call_status", "outcome"}`; `simctl.set_live_call(bool)` is counter-based.
- Agent tests live in `api/tests/agent/` and need no database (conftest overrides the DB fixture), so they run anywhere: `pytest -q api/tests/agent`.
- Full suite still needs Docker: `docker compose -f docker-compose.dev.yml up -d db && pytest -q api/tests`.

## Parts
- [x] 0 Reality check
- [x] 2 risk.py (+9 tests)
- [ ] 1 Keys and agent variables (human steps in ElevenLabs)
- [x] 3 extract.py (Gemini live check must run on your machine: `python scripts/test_gemini.py`; the build VM cannot reach Google)
- [x] 4 profiles and scripted calls
- [x] 5 call manager (trigger_call, retries, live waiter, /api/calls/current)
- [x] 6 webhook (signed) + live transcript handling (dashboard button still needed from Huzaifa)
- [x] 7 briefings (GET /api/homes/{id}/briefing, GET /api/incident/summary)
- [ ] 8 integration and rehearsal
- [ ] 9 pitch and Devpost
