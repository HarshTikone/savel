# SAVEL Frontend — Implementation Plan for Claude Code

**Owner:** Harsh · **Repo:** `https://github.com/HarshTikone/savel.git` · **Branch:** `harsh-frontend` · **Folder:** `web/` only
**Sources of truth:** `docs/frontend-prd.md` (Frontend PRD v1.1 + `claude/savel-frontend-prd-updates.md`) for the UI, and `docs/backend-prd.md` (Backend PRD v4) for every API shape, field name and enum. Where this plan adds a rule neither PRD has, it is marked **[PLAN]** and wins.

---

## 0. How to work (read first, follow every part)

You build the dashboard in **11 parts**. Each part has: goal, files, exact requirements, a **Verify gate**, and a **Commit**. Rules:

1. **One part at a time.** Do not start part N+1 until part N's Verify gate passes.
2. **Verify gate = proof.** Run every command in the gate. Paste the key output into `web/PROGRESS.md` under that part. If anything fails, fix it and re-run the whole gate. Never mark a part done with a failing check.
3. **Commit and push after every part:**
   ```bash
   git add web/
   git status            # only files under web/ staged; no .env, no dist/
   git commit -m "frontend: part N - <title>"
   git push origin harsh-frontend
   ```
4. **Tick the checklist** in `web/PROGRESS.md` in the same commit.
5. **Stay in your lane:** only edit files under `web/`. Never edit `api/`, `sim/`, `deploy/`, the root `CLAUDE.md` or the backend docs.
6. **If something is ambiguous,** follow this plan; if this plan is silent, choose the simplest option, write it in `web/PROGRESS.md` under "Decisions made during build", and continue.
7. **Steps marked HUMAN** need Harsh (reviewing visuals on the projector, running the demo). Stop and say what is needed.

### Guardrails (never break these)
- **Never invent data.** Risk, status, countdowns, accuracy and call results come from the backend. The UI may sort and format; it never computes risk or status itself.
- **Never label mock data as live.** The header always shows `LIVE`, `MOCK` or `API UNAVAILABLE` truthfully.
- **Simulated time everywhere.** Clock, chart axes, event times and "last updated" use backend `sim_now` / `t`, never the laptop clock.
- **Field names and enums exactly as Backend PRD v4.** Do not rename or add enum values.
- **No secrets, phone numbers or API keys** in browser code.
- **The browser never places calls** and never offers a real dispatch action.
- **Never a blank screen** on a failed request: keep the last data and show it as stale.
- **Not a government tool:** no seals, badges, agency names or "official" styling. Always show the `SIMULATION` label.

### The contract you build against (Backend PRD v4)
| Route | Shape |
|---|---|
| `GET /api/health` | `{ok, sim_now, run_id, rows_ingested}`; 503 when DB down |
| `GET /api/state` | `{run_id, sim_now, outdoor_f, speed, live_call, blocks:[{block, power_on}]}`; `speed` = storm seconds per real second (300 demo, 30 during a live call) |
| `GET /api/homes` | list sorted by risk of `{id, block, lat, lon, temp_f, co_ppm, power_on, heating, online, k_est, k_source, hours_to_60, hours_to_50, status, risk, call_status, outcome, age_band, medical_needs[], language}` |
| `GET /api/homes/{id}/series` | `{actual:[{t, temp_f, est}], predicted:[{t, temp_f}]}` (predicted = next 6 storm hours, 15-minute steps); 404 unknown home |
| `GET /api/events` | up to 20 `{t, type, home_id, text, severity}`, newest first |
| `GET /api/calls/current` | `null` when no call, else `{home_id, phase, source, language, transcript[], extracted}` |
| `GET /api/accuracy` | always 4 rows `{horizon_min: 30|60, k_source: learned|global, mae_f, n}`; `mae_f` null when `n == 0` |
| `POST /api/sim/{action}/{arg}` | `cut_power/{A-D}`, `restore_power/{A-D}`, `block_vent/{home_id}`, `clear_vent/{home_id}`, `outdoor/{°F}`, `speed/{int}`; 400 bad action/arg; 502 simulator down |
| `POST /api/sim/reset` | optional `?prewarm=N` (0 = clean start); new `run_id` |

**Enums:** status `heated|cooling|warning|critical|leaving` · call_status `none|queued|ringing|in_call|done|no_answer|unreachable` · outcome `none|ok|needs_help|medical|leaving|unreachable` · phase `ringing|in_call|extracting|done|no_answer` · source `live|scripted` · event type `power_cut|power_restored|vent_blocked|vent_cleared|threshold|call_started|call_result|reset` · severity `info|warning|critical` · home `k_source` `learned|median|null`.

Errors are JSON `{"detail": "..."}`. Show the `detail` text to the operator.

### Known contract gaps handled in the UI **[PLAN]**
1. `/api/state` has no vent state. Keep `ventBlocked` for H-27 in UI state, set it only after a successful POST, and clear it when `run_id` changes.
2. `transcript[]` item shape is not defined. Render strings as-is; render objects as `speaker: text` using `speaker|role` and `text|message` keys.
3. `/api/calls/current` returns `null` until Harsh's code lands. Show "No call in progress". Never fake a transcript.

---

## Target layout (end state)

```
web/
  CLAUDE.md                # frontend rules (nested; Claude Code reads it when working in web/)
  PROGRESS.md
  index.html
  package.json  package-lock.json  vite.config.js  vitest.setup.js
  .gitignore               # node_modules, dist
  src/
    main.jsx  App.jsx  App.css  tokens.css
    config.js              # poll intervals, thresholds for display only, speed presets
    services/api.js        # fetch wrapper + endpoint functions
    data/contract.js       # enums, status meta (label, color var, icon), event meta
    data/mock/             # fixtures matching the contract exactly
    lib/format.js          # sim-time, durations, temps, storm-speed labels
    lib/derive.js          # headline sentence, KPI counts, accuracy sentence (display only)
    hooks/useDashboardData.js   # polling, no overlap, stale, run_id reset
    hooks/useSeries.js
    hooks/useShortcuts.js
    components/
      Header.jsx  KpiStrip.jsx  Headline.jsx
      HomeMap.jsx  BlockGridMap.jsx  MapLegend.jsx
      PriorityQueue.jsx  HomeDetails.jsx  TemperatureChart.jsx
      CallPanel.jsx  EventLog.jsx  Banner.jsx
      SimulatorControls.jsx  AccuracyPanel.jsx
    __tests__/            # vitest + Testing Library
  scripts/
    screenshot.mjs        # optional Playwright 1280x720 capture
```

Component names follow the Frontend PRD file layout; you may add files, never rename the API service functions.

---

## Part 0 — Branch, rules, progress tracker

**Steps**
1. `git clone https://github.com/HarshTikone/savel.git && cd savel` (or pull). `git checkout -b harsh-frontend` (or check it out if it exists).
2. Confirm `web/` currently holds only `.gitkeep` (per the PRD). If a React app already exists, stop and report its structure before changing anything.
3. HUMAN: place the Frontend PRD as `docs/frontend-prd.md` if not already in the repo (this is the only file outside `web/` you may add).
4. Create `web/CLAUDE.md`:
   ```markdown
   # SAVEL frontend rules
   - Only edit files under web/.
   - API shapes, field names and enums come from docs/backend-prd.md; never rename them.
   - Never compute risk or status in the browser; display backend values.
   - Simulated time only (sim_now, t); never the laptop clock.
   - Never show mock data as LIVE; never blank the screen on errors.
   - No secrets, phone numbers or keys in browser code. The browser never places calls.
   - No government seals, badges or agency names; always show SIMULATION.
   - Test: cd web && npm test -- --run ; Build: npm run build
   ```
5. Save this plan as `web/IMPLEMENTATION_PLAN.md`.
6. Create `web/PROGRESS.md` with `- [ ] Part 0` … `- [ ] Part 10`, plus "Verify output" and "Decisions made during build".

**Verify gate**
```bash
git branch --show-current            # harsh-frontend
ls web/CLAUDE.md web/PROGRESS.md web/IMPLEMENTATION_PLAN.md
git status --porcelain | grep -v '^.. web/' | grep -v 'docs/frontend-prd.md' || echo ONLY_WEB
```

**Commit:** `frontend: part 0 - branch, rules, progress tracker`

---

## Part 1 — Scaffold, tooling, design tokens

**Goal:** a React + Vite app that builds, tests and proxies `/api` to the backend.

**Steps**
1. `cd web && npm create vite@5 . -- --template react` (JavaScript, `.jsx`). Remove the template demo content.
2. Install pinned versions:
   ```bash
   npm i react@18.3.1 react-dom@18.3.1 leaflet@1.9.4 react-leaflet@4.2.1 recharts@2.13.3 lucide-react@0.460.0
   npm i -D vite@5.4.11 @vitejs/plugin-react@4.3.4 vitest@2.1.8 jsdom@25.0.1 @testing-library/react@16.1.0 @testing-library/jest-dom@6.6.3
   ```
3. `vite.config.js`: react plugin; dev server proxy `'/api' → process.env.VITE_API_TARGET || 'http://localhost:8000'` with `changeOrigin: true`; vitest `environment: 'jsdom'`, `setupFiles: './vitest.setup.js'` (imports `@testing-library/jest-dom`).
4. `package.json` scripts: `dev`, `build`, `preview`, `test` (`vitest`).
5. `src/tokens.css`: color tokens. Base: navy background `#0B1420`, slate surfaces `#152437`, light text `#E8EDF3`, muted gold accent `#B89B5E`, muted text, line color. **Status tokens [PLAN]** (temperature metaphor shared with the concept page): heated = ember `#FF7A3D`; cooling = sand `#8C6B50`; warning = ice blue `#4C8CC6`; critical = deep cold fill `#CFE6FA` with alarm ring `#FF5C8A`; leaving = green `#7FD3A0`. Fonts: system UI stack for text, a monospace stack for numbers; `font-variant-numeric: tabular-nums` on all numbers.
6. `src/config.js`: `POLL_MS = 2000`, `HEALTH_MS = 5000`, `STALE_AFTER_FAILS = 2`, `SPEED_PRESETS = [{value:30,label:'0.5 storm min/s'},{value:300,label:'5 storm min/s (demo)'},{value:600,label:'10 storm min/s'}]`, `VENT_HOME = 'H-27'`, `QUEUE_SIZE = 10`, `DATA_MODE = import.meta.env.VITE_DATA_MODE || 'live'` (`mock` or `live`).
7. `web/.gitignore`: `node_modules/`, `dist/`, `.env*`.

**Verify gate**
```bash
cd web && npm run build && ls dist/index.html
npm test -- --run          # 0 tests is fine but runner must start
npm run dev & sleep 4; curl -s localhost:5173 | grep -q '<div id="root">' && echo DEV_OK; kill %1
```

**Commit:** `frontend: part 1 - vite react scaffold, pinned deps, api proxy, design tokens`

---

## Part 2 — Contract layer: enums, status meta, formatters, API client, mock fixtures

**Goal:** one place that knows the backend shapes, so components never guess.

**`src/data/contract.js`**
- Export every enum array from the contract section.
- `STATUS_META`: for each status `{label, colorVar, icon}`: heated "Heated" flame; cooling "Cooling" thermometer; warning "Warning" snowflake; critical "Critical" alert-triangle; leaving "Safe, leaving" check-circle. Icons from `lucide-react`.
- `CALL_STATUS_LABEL`: none "Not called", queued "In queue", ringing "Ringing", in_call "On call", done "Call done", no_answer "No answer", unreachable "Unreachable".
- `OUTCOME_LABEL`: none "—", ok "OK", needs_help "Needs help", medical "Medical", leaving "Safe, leaving", unreachable "Unreachable".
- `SEVERITY_META`: info, warning, critical with color vars.

**`src/lib/format.js`**
- `simClock(iso)` → "9:20 PM" using `Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', hour:'numeric', minute:'2-digit'})`.
- `stormDuration(hours)` → `null` → "—"; `0` → "now"; else "1h 05m" / "42m", with suffix " storm time" available.
- `temp(f)` → "58.4°F"; `ppm(x)` → "62 ppm".
- `speedLabel(speed)` → `${speed/60} storm min/s` (e.g. 300 → "5 storm min/s").

**`src/services/api.js`**
- `request(path, opts)` → fetch relative `/api…`; parse JSON; on non-2xx throw `ApiError {status, detail}` using the body's `detail` when present; network errors throw `ApiError {status:0, detail:'Network error'}`.
- Endpoint functions: `getHealth, getState, getHomes, getSeries(id), getEvents, getCurrentCall, getAccuracy, simAction(action, arg), simReset({prewarm})` (`prewarm` undefined → no query param).
- When `DATA_MODE === 'mock'`, the same functions return fixtures from `data/mock/` (with a short artificial delay) and `simAction`/`simReset` resolve without changing anything **and the header shows MOCK**.

**`src/data/mock/`** — fixtures that match the contract exactly: `state.json`, `homes.json` (40 homes, blocks A–D, at least: H-13 warning oxygen, H-16 critical 75+, H-27 critical CO 62 ppm, several heated, one `leaving`, one `online:false`), `series-H-13.json`, `events.json`, `accuracy.json` (4 rows), `call.json` (`source:"scripted"`). When Piyush publishes `docs/samples/*.json`, replace fixtures with those.

**Tests (`src/__tests__/contract.test.js`, `format.test.js`, `api.test.js`)**
- Every mock home has exactly the contract keys and valid enum values.
- `stormDuration(1.0833)` → "1h 05m"; `stormDuration(0)` → "now"; `stormDuration(null)` → "—".
- `simClock('2026-11-08T02:20:00Z')` → "9:20 PM".
- `speedLabel(300)` → "5 storm min/s".
- `request` throws `ApiError` with the backend `detail` on a 400 (mock `fetch`).

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```

**Commit:** `frontend: part 2 - contract enums, status meta, formatters, api client, mock fixtures`

---

## Part 3 — Data hook: polling, no overlap, stale state, run_id reset

**Goal:** a single hook that keeps the dashboard fed and honest.

**`src/hooks/useDashboardData.js`** returns `{state, homes, events, call, accuracy, health, connection, lastUpdated, refresh, runId}`.
- Every `POLL_MS`: fetch `state, homes, events, calls/current, accuracy` with `Promise.allSettled`. **Skip a tick if the previous one is still in flight** (ref flag).
- Health every `HEALTH_MS`.
- Keep the last successful value per resource. Count consecutive full failures; after `STALE_AFTER_FAILS` set `connection = 'stale'`; on success set `'live'`; in mock mode always `'mock'`; if health returns 503 or network error → `'unavailable'` while keeping last data.
- `lastUpdated` = latest `sim_now` received (simulated time).
- **run_id reset [PLAN]:** when `state.run_id` changes from a previous non-null value, clear `events`, `call`, `accuracy`, and emit an `onRunChange` callback so the app clears the selected home, series cache, banner queue and vent state.
- `refresh()` triggers an immediate fetch (used after controls succeed).
- Clean up timers on unmount.

**`src/hooks/useSeries.js`**: fetch `getSeries(selectedId)` on selection and every `POLL_MS` while selected; no overlap; 404 → `{error:'Unknown home'}`; cleared on run change.

**Tests (`src/__tests__/useDashboardData.test.jsx`)** with fake timers and a mocked api module:
- No overlapping requests when a fetch takes longer than the interval.
- Two consecutive failures → `connection === 'stale'` and previous homes still returned.
- `run_id` change → events/call/accuracy cleared and `onRunChange` called once.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```

**Commit:** `frontend: part 3 - polling hook with no overlap, stale state and run_id reset`

---

## Part 4 — App shell: header, KPI strip, headline, layout modes

**Goal:** the frame the demo is read from in five seconds.

**`App.jsx`** owns `selectedHomeId`, `demoLayout` (bool), `ventBlocked`, banner queue; wires `useDashboardData` and `useSeries`.

**Layout (CSS grid) [PLAN]:**
- Normal (≥1280 px wide): row 1 Header; row 2 KPI strip + Headline; row 3 Map (≈55%) | Priority queue (≈45%); row 4 Home details + chart | Call panel; row 5 Event log | Simulator controls | Accuracy panel.
- Demo layout (toggle button and `D` key): hides Event log and Accuracy panel, enlarges map and queue, increases font sizes ~15%.
- Narrow (<900 px): single column in this order: Header, Headline, KPI, Queue, Map, Details, Call, Controls, Events, Accuracy.
- Target 1280×720 first: no horizontal scroll, no clipped panels.

**`Header.jsx`:** "SAVEL" wordmark, persistent `SIMULATION` pill, connection badge (`LIVE` / `MOCK` / `STALE · RECONNECTING` / `API UNAVAILABLE`), simulated clock from `state.sim_now`, outdoor °F, speed label, and "Slowed for live call" when `state.live_call`.

**`KpiStrip.jsx`:** total homes, critical, warning, blocks without power (from `state.blocks`), calls needing help (`outcome in ['needs_help','medical']`), offline sensors. Counts come from backend values only.

**`Headline.jsx` / `lib/derive.js`:** one sentence from backend data, e.g. "3 homes critical · next home reaches 50°F in 22m storm time". Use the smallest non-null `hours_to_50` among homes with status `cooling` or `warning`. Clean state: "All 40 homes heated. Cut power to a block to begin."

**Tests:** derive headline for (a) all heated, (b) mixed fixtures; header shows `MOCK` in mock mode and never `LIVE`; KPI counts match fixture counts.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
VITE_DATA_MODE=mock npm run dev & sleep 4; curl -s localhost:5173 >/dev/null && echo DEV_OK; kill %1
```
HUMAN (optional now, required in Part 10): open `http://localhost:5173` at 1280×720 and confirm header, KPI and headline read clearly.

**Commit:** `frontend: part 4 - app shell, header, kpi strip, headline, demo layout`

---

## Part 5 — Map with fallback and selection sync

**Goal:** 40 homes on a map that never goes blank.

**`HomeMap.jsx` (React Leaflet):**
- `import 'leaflet/dist/leaflet.css'`. OpenStreetMap tiles with attribution. Fit bounds to the homes on first data and on run change.
- Each home is a `CircleMarker` (no image icons): fill = status color; critical gets the alarm-color ring (thicker stroke); offline gets a dashed stroke and hollow fill; selected gets a thick light outline. Tooltip: id, status label, temp, countdown.
- **Update marker styles in place [PLAN]:** keep one marker per home keyed by `id`; do not remount markers on every poll (no flicker).
- Light block outlines (A–D) drawn as rectangles around each block's homes; a block without power gets a dashed alarm outline and "Block B · no power" label.
- Clicking a marker sets `selectedHomeId`.

**`BlockGridMap.jsx` (fallback):** an SVG 2×2 block grid (same idea as the concept page): 10 house shapes per block in two rows, same status colors and selection behavior, block labels with "no power" state.
- Switch automatically after 3 `tileerror` events; a manual "Map / Grid" toggle is always available.

**`MapLegend.jsx`:** status swatch + icon + label for all five statuses, plus offline marker.

**Tests:** BlockGridMap renders 40 selectable homes and calls `onSelect('H-13')` on click; legend shows five status labels; markers use backend `status` only.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```
HUMAN: in mock mode, click a marker → the same home is highlighted in the queue (after Part 6) and details.

**Commit:** `frontend: part 5 - leaflet map, block-grid fallback, legend, selection`

---

## Part 6 — Priority queue and home details

**Goal:** who to reach first, and why.

**`PriorityQueue.jsx`:**
- Shows the top `QUEUE_SIZE` homes from `/api/homes` in backend order (already sorted by risk), excluding `heated` homes; empty state: "No homes need attention."
- Each row: rank number in a status-colored badge, home id, block, temp, risk, tags (age band if `65-74` or `75+`, each medical need, language if not `en`, "estimated" if `online:false`), call-status badge.
- Right column: if `co_ppm >= 35` → "CO 62 ppm"; else if `hours_to_50 === 0` → "below 50°F"; else `stormDuration(hours_to_50)` + "to 50°F".
- **Re-rank animation [PLAN]:** when a home moves up, slide/highlight its row for ~1.5 s (CSS transform keyed by id; respect `prefers-reduced-motion`).
- Clicking a row selects the home; keyboard Enter/Space too. Selection syncs with the map.

**`HomeDetails.jsx`:** id, block, status chip, temp, CO, power, heating, online/estimated, `k_est` with `k_source` ("learned" / "neighborhood median"), hours to 60°F and 50°F (formatted; "passed" when 0), age band, medical needs, language, call status and outcome. Null values show "Unavailable". If the selected home disappears, show a neutral "Home not in current run" state; never auto-select a random home.

**Tests:** queue shows at most 10 rows and no heated homes; CO home shows ppm text instead of a countdown; clicking a row calls `onSelect`; details show "Unavailable" for null `k_est`.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```

**Commit:** `frontend: part 6 - priority queue with re-rank animation and home details`

---

## Part 7 — Temperature chart

**Goal:** measured vs estimated vs predicted, readable from the judges' table.

**`TemperatureChart.jsx` (Recharts):**
- X axis = simulated time from series `t`, ticks formatted with `simClock`; Y axis °F with a domain that always includes 50 and 68 and the data min.
- Lines: measured (`est:false`) solid; estimated (`est:true`) dotted; predicted dashed in the accent/ember color. Split `actual` into contiguous runs by `est` so each run renders with its own style.
- Reference lines at 60°F ("warning") and 50°F ("critical") with labels; a vertical "now" marker at the last actual point.
- Legend: Measured, Estimated (sensor offline), Predicted.
- Loading, empty ("No readings yet") and error states; never draw invented points.
- Keep labels at least 12 px and the chart ≥ 220 px tall at 1280×720.

**Tests:** given fixture series with an `est:true` tail, the component renders three legend entries and both reference labels; empty series shows the empty state.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```

**Commit:** `frontend: part 7 - temperature chart with measured, estimated and predicted series`

---

## Part 8 — Call panel, event log, banner

**Goal:** make the AI check-in visible and the cause-and-effect obvious.

**`CallPanel.jsx`:**
- `call === null` → "No call in progress" (plus the last completed call from events if available, labeled as past).
- Otherwise: home id, `source` badge (`LIVE TEST` for live, `SCRIPTED` for scripted), language, phase stepper (ringing → in_call → extracting → done; `no_answer` shown as its own end state), transcript lines (strings or `{speaker|role, text|message}`), and **extracted fields as chips [PLAN]**: "No heat" / "Has heat" from `has_heat`, "Needs help" from `needs_help`, the `medical_issue` text, "Can leave" / "Can't leave" from `can_leave`; unknown keys as plain chips. Raw JSON in a collapsed `<details>`.
- **Auto-focus [PLAN]:** when a new `call.home_id` appears, select that home, pulse its map marker for 3 s and highlight the panel.

**`EventLog.jsx`:** newest first, max 20, time via `simClock(t)`, severity color + icon, text; clicking an event with `home_id` selects that home. Malformed events are skipped, never crash the list.

**`Banner.jsx` [PLAN]:** a one-line, 4-second banner for new `critical` events and new `call_result` events (e.g. "H-27 · carbon monoxide 62 ppm", "H-13 needs help"). Track seen events by `t + type + home_id`. Add `aria-live="polite"` on the banner region so screen readers announce critical changes.

**Tests:** null call shows "No call in progress"; scripted call shows `SCRIPTED`; extracted object renders chips; event click selects home; banner shows once per new critical event.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```

**Commit:** `frontend: part 8 - call panel with chips and auto-focus, event log, banner`

---

## Part 9 — Simulator controls, accuracy panel, keyboard shortcuts

**Goal:** run the demo the same way every time, and show the AI/ML proof.

**`SimulatorControls.jsx`** (titled "SIMULATOR CONTROLS"):
- Block A–D toggle buttons: pressed state from `state.blocks[].power_on` (never from the last click). Clicking sends `cut_power/{B}` or `restore_power/{B}`.
- Vent button for `VENT_HOME`: "Block vent at H-27" / "Clear vent at H-27" from UI `ventBlocked` (set only after success; cleared on run change).
- Outdoor slider −10…30 °F: send `outdoor/{v}` on release (not on every move); show the backend `outdoor_f` value.
- Speed presets from `SPEED_PRESETS` → `speed/{v}`; show current `speedLabel(state.speed)`; show "Slowed for live call" when `state.live_call`.
- Two reset buttons **[PLAN]**: "Reset (pre-warmed)" → `simReset()` and "Reset (clean start)" → `simReset({prewarm:0})`; the team picks which one to use for the pitch.
- Every control: disabled while its request is pending, shows a spinner, shows the backend `detail` on error, and calls `refresh()` on success. In mock mode controls show "Mock mode: no backend changes".

**`AccuracyPanel.jsx`:** a 2×2 table (30 / 60 min × learned / global) with `mae_f` °F and `n`; null → "Insufficient observations". **Sentence [PLAN]:** only when both 60-minute rows have `n > 0` and learned < global: "Learning each home's insulation cut 60-minute error from {global}°F to {learned}°F." Otherwise no claim.

**`useShortcuts.js` [PLAN, P2]:** `B` toggle Block B, `V` toggle vent, `R` reset (pre-warmed), `D` demo layout. Ignored while focus is in an input, select or textarea. Show a small "?" help popover listing them.

**Tests:** block buttons reflect `state.blocks`; button disabled while pending; error detail rendered on 400; accuracy sentence appears only when learned < global with n > 0; shortcuts ignored while typing in the slider/input.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
```

**Commit:** `frontend: part 9 - simulator controls, two reset modes, accuracy panel, shortcuts`

---

## Part 10 — Live integration, projector polish, build handoff, PR

**Goal:** the real dashboard on the real backend, readable on a projector, delivered as `web/dist` for Caddy.

**Steps**
1. **Run against Piyush's backend:** either his local stack (`docker compose -f docker-compose.dev.yml up -d --build` from repo root once backend Part 7 is merged) or his deployed domain via `VITE_API_TARGET=https://<domain> npm run dev`. Set `VITE_DATA_MODE=live`.
2. **Contract check script [PLAN]:** `npm run check:contract` (node script) fetches every GET endpoint from the target and validates keys and enum values against `src/data/contract.js`; prints mismatches. Fix the UI only; report backend mismatches to Piyush in `PROGRESS.md`.
3. **Demo run-through (HUMAN with Claude Code observing):** Reset (clean) → cut Block B → homes turn warning within ~40 s → queue re-ranks → a call appears (scripted or live) → block vent at H-27 → CO banner and critical → accuracy shows numbers → Reset. Repeat 3 times; same order each time.
4. **Projector polish at 1280×720:** no horizontal overflow, no clipped panels, numbers readable from ~3 m, focus rings visible, color + icon + text for every status.
5. **Optional screenshots:** `scripts/screenshot.mjs` with Playwright (if installable) saves `web/docs-shots/calm.png`, `outage.png`, `critical-call.png` at 1280×720 for Devpost. Do not commit large binaries if the team prefers; otherwise commit under `web/docs-shots/`.
6. **Build handoff:** `npm run build` produces `web/dist`. `dist/` is gitignored. On the VM, Piyush builds it without installing Node:
   ```bash
   docker run --rm -v "$PWD/web:/app" -w /app node:20 sh -c "npm ci && npm run build"
   ```
   Caddy serves `web/dist` at `/` and proxies `/api/*` (relative paths already work).
7. Update `web/README.md`: run modes (mock/live), env vars (`VITE_DATA_MODE`, `VITE_API_TARGET`), shortcuts, demo script, build command.
8. Open a PR `harsh-frontend → main` titled "SAVEL dashboard"; request review from Piyush.

**Verify gate**
```bash
cd web && npm test -- --run && npm run build
VITE_API_TARGET=http://localhost:8000 npm run check:contract     # 0 mismatches (or mismatches logged and reported)
npm run preview & sleep 3; curl -s localhost:4173 | grep -q 'root' && echo PREVIEW_OK; kill %1
grep -rnE '(\+1[0-9]{10}|sk-|AIza|ELEVEN|TWILIO)' src/ || echo NO_SECRETS
```
HUMAN sign-off in `PROGRESS.md`: three full demo runs at 1280×720 on the live backend with no blank screens.

**Commit:** `frontend: part 10 - live integration, projector polish, contract check, build handoff` → push → open PR.

---

## Running this alongside the agent plan (Harsh owns both) **[PLAN]**

Harsh now owns this frontend plan **and** `docs/SAVEL_Agent_Implementation_Plan.md`. Run them as two separate Claude Code sessions in parallel:

- **Separate working copies so the sessions never collide:** keep the agent work in the main clone on branch `harsh-agent`, and the frontend in a second checkout:
  ```bash
  git worktree add ../savel-web harsh-frontend   # or: git worktree add -b harsh-frontend ../savel-web origin/main
  ```
  Start the frontend Claude Code session inside `../savel-web`.
- **Session rules:** the frontend session edits only `web/`; the agent session edits only Harsh's agent files. Neither touches Piyush's files.
- **Order of Harsh's own (HUMAN) time:** (1) agent Part 1 first (accounts, verified phones, first real call), since it is the riskiest; (2) then let both sessions run while you review frontend gates visually and answer HUMAN prompts as they appear.
- **Fast path for the frontend:** if time gets tight, port the layout, colors and status logic from the Heat Check concept page (the published artifact) instead of designing from scratch.
- **Demo roles:** Harsh pitches; **Piyush drives the dashboard** during judging (he knows the controls from the backend side). Give him the keyboard shortcuts from Part 9.

## Timeline (Saturday Nov 7 → Sunday Nov 8)

| By | Parts done | Team checkpoint |
|---|---|---|
| 5:15 PM | 0, 1, 2 | App builds; contract layer and mock fixtures ready |
| 7:00 PM | 3, 4, 5, 6 | Live polling against Piyush's API; map + queue; cutting Block B visibly changes the dashboard |
| 11:00 PM | 7, 8, 9 | Chart, call panel, events, controls, accuracy; Devpost draft screenshots |
| 3:00 AM | 10 (polish) | Projector polish, contract check clean |
| 9:30 AM | 10 (sign-off) | Three full demo runs on the live domain; feature freeze |

If behind, cut in this order: keyboard shortcuts, phone-friendly layout polish, re-rank animation, banner. Never cut the map, queue with countdowns, call panel, simulator controls or accuracy panel.

---

## Definition of done (frontend)

- `npm test -- --run` and `npm run build` pass; `check:contract` reports no UI-side mismatches.
- 40 homes on the map (or grid fallback), selection synced across map, queue, details and chart.
- Header truthfully shows LIVE/MOCK/STALE/UNAVAILABLE, SIMULATION, simulated clock, speed and live-call slowdown.
- Block B outage, vent block, outdoor and speed controls, and both reset modes work through the backend, with pending and error states.
- Call panel shows source, language, phase, transcript and extracted chips, or "No call in progress".
- Accuracy panel shows real learned vs global error, never an invented claim.
- Readable at 1280×720 with no overflow; `web/dist` builds for Caddy; PR open.
