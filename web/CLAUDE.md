# SAVEL frontend rules
- Only edit files under web/.
- API shapes, field names and enums come from docs/backend-prd.md; never rename them.
- Never compute risk or status in the browser; display backend values.
- Simulated time only (sim_now, t); never the laptop clock.
- Never show mock data as LIVE; never blank the screen on errors.
- No secrets, phone numbers or keys in browser code. The browser never places calls.
- No government seals, badges or agency names; always show SIMULATION.
- Test: cd web && npm test -- --run ; Build: npm run build
