# SAVEL — implementation plan (3 people)

Hard deadlines: Devpost draft Sat 11:00 PM · Final submission Sun 11:30 AM (aim 11:00) · Judging Sun 1:45 PM (4 min pitch + 1 min Q&A).

## Roles
- Harsh (AI + voice + pitch): ElevenLabs agent, Twilio, call webhook, Gemini extraction/briefings, risk rules, pitch.
- Piyush (backend + data + infra): FastAPI, Tiger Data, simulator integration, prediction + risk API, Vultr + Caddy + GoDaddy domain.
- Huzaifa (frontend + demo): React + Vite + Leaflet + Recharts dashboard, call panel, controls, Devpost visuals, drives the live demo.

## Repo layout
savel/
  api/        FastAPI app (ingest, homes, series, calls webhook, sim proxy)
  sim/        simulator.py
  web/        React + Vite app
  deploy/     docker-compose.yml, Caddyfile
  README.md

## API contract (agree first, then build in parallel)
- POST /api/ingest  [{time, home_id, temp_f, co_ppm, power_on}]
- GET  /api/homes   [{id, block, lat, lon, temp_f, co_ppm, power_on, online, k_est, hours_to_60, hours_to_50, risk, status, call_status, outcome, age_band, medical_needs, language}]
- GET  /api/homes/{id}/series  {actual:[{t,temp_f,est}], predicted:[{t,temp_f}]}
- GET  /api/events  latest 20 log lines
- GET  /api/calls/current  {home_id, phase, transcript[], extracted}
- POST /api/calls/webhook  ElevenLabs post-call transcript
- POST /api/sim/{cut_power|restore_power|block_vent|clear_vent|outdoor}/{arg}  proxied to simulator
- GET  /api/accuracy  predicted vs actual error (30 and 60 min ahead)

## Tiger Data schema
homes(id text primary key, block text, lat float, lon float, age_band text, medical_needs text, language text, phone text, battery bool)
readings(time timestamptz not null, home_id text, temp_f float, co_ppm float, power_on bool) -> SELECT create_hypertable('readings', by_range('time'));
calls(id serial, home_id text, started_at timestamptz, status text, transcript text, extracted jsonb, outcome text)
Simulator timestamps are simulated time: measure windows from the latest reading, not now().

## Timeline
### 3:15–4:15 PM — riskiest pieces first
- Harsh: ElevenLabs agent with check-in script; Twilio number; verify all 3 phones; one successful outbound test call to own phone.
- Piyush: Tiger Cloud DB + schema; FastAPI /ingest writing to Tiger; simulator streaming into it. Start Vultr VM and claim the GoDaddy Registry domain now (DNS takes time).
- Huzaifa: Vite + React scaffold; Leaflet map with 40 mock homes matching the contract; ranked list from mock data.
Checkpoint 4:15: a call reached a phone, readings land in Tiger, map renders.

### 4:15–5:15 PM — Harsh at Radial Ventures workshop (Davis 101). Piyush and Huzaifa continue.

### 5:15–7:00 PM
- Harsh: webhook endpoint; Gemini extraction with a JSON schema {has_heat, needs_help, medical_issue, can_leave}; test on 3 sample transcripts.
- Piyush: GET /api/homes with cooling rate (regr_slope), Newton's-law countdowns, risk score; series endpoint; 5-second background loop.
- Huzaifa: switch to live API (poll every 2 s); countdown list; home detail chart (actual vs predicted, 60°F and 50°F lines).
Checkpoint 7:00: cutting power to Block B turns homes blue on the live dashboard.

### 7:00–8:15 PM — dinner. Draft Devpost text while eating.

### 8:15–11:00 PM
- Harsh: full call loop. Home crosses 60°F -> backend triggers call -> webhook -> Gemini -> risk updates. Real calls only for homes mapped to team phones; every other home gets a scripted simulated call so the demo never depends on 40 real calls.
- Piyush: deploy with docker compose (api, sim, caddy serving web build) on Vultr; Caddy auto-HTTPS on the domain; set webhook URL in ElevenLabs.
- Huzaifa: call panel (transcript + extracted JSON), event log, control buttons (cut power, block vent, outdoor temp).
11:00 PM: submit Devpost draft. Repo public.

### 11:00 PM–3:00 AM
- Harsh: Gemini responder briefing per home + incident summary; carbon monoxide script and scenario.
- Piyush: sensor-offline estimation (homes without battery stop reporting when power is out; keep estimating from learned k); /api/accuracy.
- Huzaifa: accuracy panel, legend, mobile layout, polish.
3:00–7:00 AM: sleep in shifts; one person awake watching the deployed site.

### Sunday
- 7:30–8:45 breakfast
- 8:45–9:30 bug bash: run the full demo three times on the live domain
- 9:30 feature freeze. Record a backup demo video, screenshots, finish Devpost, opt into Radial Atoms, General, AI/ML, UI/UX, Tiger Data, Gemini, ElevenLabs, Vultr, GoDaddy
- 11:00 submit final
- 11:30–1:45 lunch, rehearse the 4-minute pitch at least 3 times
- 1:45 judging. Harsh pitches, Huzaifa drives the demo, Piyush answers technical questions

## Cut order if behind
1. Real phone calls (switch to simulated calls in the dashboard)
2. Carbon monoxide scenario
3. Incident summary
4. Sensor-offline estimation
Never cut: map, countdowns, call loop, accuracy number.

## Known risks
- Twilio trial calls only verified numbers.
- ElevenLabs webhook needs a public HTTPS URL; use a tunnel until Vultr is live.
- Home Wi-Fi dies in outages; pitch battery + cellular sensors and show the estimate mode.
- Ask an organizer to confirm prizes can stack.
