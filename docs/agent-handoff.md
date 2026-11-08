# Agent handoff: what is built and what each person still has to do

Built on branch `harsh-agent` (all offline-tested: `pytest -q api/tests/agent`, no database needed).

| Piece | Where |
|---|---|
| Deterministic risk | api/risk.py |
| Gemini extraction + keyword fallback | api/agent/extract.py |
| Scripted residents (H-18 answers on retry, H-35 never answers) | api/agent/profiles.py, scripts.py |
| Call queue, retry after 20 storm minutes, unreachable | api/agent/manager.py |
| Signed webhook + live browser transcript | api/agent/elevenlabs.py, api/calls.py |
| Responder briefing + incident summary (new routes) | api/agent/briefing.py |

## Harsh (needs a browser or keys; I cannot do these)
1. ElevenLabs agent > Vars: rename/add `resident_label`, `home_id`, `reason`, `language` with defaults ("there", "H-13", "warning", "English"). Paste voice/agent_prompt.md again (it now uses `{{resident_label}}` and `{{reason}}`).
2. ElevenLabs > Webhooks: post-call transcription webhook to `<PUBLIC_BASE_URL>/api/calls/webhook`; copy the signing secret to `.env` as `ELEVENLABS_WEBHOOK_SECRET`.
3. Public URL while Vultr is not live: `cloudflared tunnel --url http://localhost:8000`.
4. Run `python scripts/test_gemini.py` once on your machine (the build VM cannot reach Google). It must print `source: gemini`.
5. Redeem the MLH ElevenLabs credits.

## Huzaifa (web/ is his; I did not touch it)
Add a "Call resident" button that opens the ElevenLabs session for the home in the call panel, passing dynamic variables exactly:
`{ resident_label: "Resident at " + home.id + " (Block " + home.block + ")", home_id: home.id, reason: home.status, language: <language name> }`.
`home_id` is how the webhook finds the home, so it must be sent. The backend does the rest and the panel fills from `GET /api/calls/current`.
Optional: show `GET /api/homes/{id}/briefing` in home details and `GET /api/incident/summary` in the headline. `calls/current` transcript is strings; `extracted.medical_issue` is text or false.

## Piyush
- Loop contract is unchanged (`risk_score`, `trigger_call`, `set_live_call`).
- Known: seed race on first `compose up` (frontend reported it).
- New optional env: `LIVE_HOMES=H-13` (which home gets the live browser call), `LIVE_CALL_WAIT_S=420`, `ELEVENLABS_WEBHOOK_SECRET`, `GEMINI_API_KEY`.
- `google-genai` was added to api/requirements.txt; rebuild the api image.

## Demo behaviour
- H-13 (live home): rings in the dashboard, slows the sim to 30x, waits up to 7 minutes (LIVE_CALL_WAIT_S) for a browser call. No call finishes in time: it falls back to a scripted call, so the demo never stalls.
- Everyone else gets a scripted call (about 8 seconds each, three at a time).
