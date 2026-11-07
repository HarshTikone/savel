# SAVEL

Heat-loss early warning for homes during power outages. Sensors stream indoor temperature and CO, the backend predicts when each home will cross 60°F and 50°F (Newton's law of cooling), an ElevenLabs voice agent checks in on at-risk residents, Gemini extracts structured results from the call, and responders get a ranked map and briefings.

## Team
- Harsh: AI + voice + pitch (ElevenLabs, Twilio, webhook, Gemini, risk rules)
- Piyush: backend + data + infra (FastAPI, Tiger Data, simulator, prediction API, Vultr, Caddy, domain)
- Huzaifa: frontend + demo (React, Vite, Leaflet, Recharts, call panel, Devpost visuals)

## Layout
```
api/      FastAPI app (ingest, homes, series, calls webhook, sim proxy)
sim/      simulator.py
web/      React + Vite app
deploy/   docker-compose.yml, Caddyfile
docs/     implementation plan
```

## Quick start
```bash
cp .env.example .env          # fill in keys
cd api && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Frontend: `cd web && npm install && npm run dev` (after scaffolding with Vite).

## API contract
See `api/main.py` for stubs and `docs/implementation-plan.md` for the full spec. Agree on the contract first, then build in parallel.

## Notes
- Simulator timestamps are simulated time: measure windows from the latest reading, not `now()`.
- Never commit `.env`.
