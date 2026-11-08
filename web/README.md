# SAVEL dashboard (web)

React + Vite single-page dashboard for the SAVEL storm-outage simulation. Always labelled `SIMULATION`.

## Run modes

| Mode | Command | Header badge |
|---|---|---|
| Mock (fixtures, no backend) | `VITE_DATA_MODE=mock npm run dev` | `MOCK` |
| Live (proxy to backend) | `VITE_API_TARGET=http://localhost:8000 npm run dev` | `LIVE` / `STALE · RECONNECTING` / `API UNAVAILABLE` |

On Windows PowerShell set variables first: `$env:VITE_DATA_MODE='mock'; npm run dev`.

## Environment variables

- `VITE_DATA_MODE`: `live` (default) or `mock`.
- `VITE_API_TARGET`: backend origin for the dev proxy and `check:contract` (default `http://localhost:8000`).

## Keyboard shortcuts

`B` toggle Block B power · `V` toggle vent at H-27 · `R` reset (pre-warmed) · `D` demo layout. Ignored while typing in a field. Press the `?` button in the header to see them.

## Demo script

1. Reset (clean start).
2. Cut Block B: homes turn warning within about 40 s and the queue re-ranks.
3. A call appears (scripted or live) and the dashboard auto-selects that home.
4. Block the vent at H-27: CO banner, home goes critical.
5. Accuracy panel shows learned vs global error.
6. Reset.

## Scripts

- `npm test -- --run` run unit tests
- `npm run build` build to `dist/`
- `npm run check:contract` validate a running backend against the UI contract

## Build for Caddy

`dist/` is gitignored. On the VM, without installing Node:

```bash
docker run --rm -v "$PWD/web:/app" -w /app node:20 sh -c "npm ci && npm run build"
```

Caddy serves `web/dist` at `/` and proxies `/api/*`; the app uses relative `/api` paths.

## Rules

See `CLAUDE.md`. Display backend values only, simulated time only, no secrets in browser code, the browser never places calls.
