// Validates GET endpoints from a running backend against src/data/contract.js.
// Usage: VITE_API_TARGET=http://localhost:8000 npm run check:contract
import {
  HOME_KEYS, STATUSES, CALL_STATUSES, OUTCOMES, PHASES, SOURCES, EVENT_TYPES, SEVERITIES, K_SOURCES,
} from '../src/data/enums.js'

const base = (process.env.VITE_API_TARGET || 'http://localhost:8000').replace(/\/$/, '')
const problems = []
const bad = (where, msg) => problems.push(`${where}: ${msg}`)

async function get(path) {
  try {
    const res = await fetch(base + path)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      bad(path, `HTTP ${res.status} ${body && body.detail ? body.detail : ''}`)
      return undefined
    }
    return body
  } catch (e) {
    bad(path, `unreachable (${e.message})`)
    return undefined
  }
}

const needKeys = (where, obj, keys) => {
  if (!obj || typeof obj !== 'object') return bad(where, 'not an object')
  for (const k of keys) if (!(k in obj)) bad(where, `missing key "${k}"`)
}
const needEnum = (where, v, list) => {
  if (!list.includes(v)) bad(where, `value "${v}" not in [${list.join('|')}]`)
}

const health = await get('/api/health')
if (health) needKeys('/api/health', health, ['ok', 'sim_now', 'run_id', 'rows_ingested'])

const state = await get('/api/state')
if (state) {
  needKeys('/api/state', state, ['run_id', 'sim_now', 'outdoor_f', 'speed', 'live_call', 'blocks'])
  for (const b of state.blocks || []) needKeys('/api/state blocks[]', b, ['block', 'power_on'])
}

const homes = await get('/api/homes')
if (homes) {
  if (!Array.isArray(homes)) bad('/api/homes', 'not an array')
  else {
    for (const h of homes) {
      needKeys(`/api/homes ${h.id}`, h, HOME_KEYS)
      needEnum(`/api/homes ${h.id} status`, h.status, STATUSES)
      needEnum(`/api/homes ${h.id} call_status`, h.call_status, CALL_STATUSES)
      needEnum(`/api/homes ${h.id} outcome`, h.outcome, OUTCOMES)
      if (h.k_source !== null && h.k_source !== undefined) needEnum(`/api/homes ${h.id} k_source`, h.k_source, K_SOURCES)
    }
    if (homes.length > 0) {
      const series = await get(`/api/homes/${encodeURIComponent(homes[0].id)}/series`)
      if (series) {
        needKeys('series', series, ['actual', 'predicted'])
        for (const p of (series.actual || []).slice(0, 3)) needKeys('series.actual[]', p, ['t', 'temp_f', 'est'])
        for (const p of (series.predicted || []).slice(0, 3)) needKeys('series.predicted[]', p, ['t', 'temp_f'])
      }
    }
  }
}

const events = await get('/api/events')
if (events) {
  if (!Array.isArray(events)) bad('/api/events', 'not an array')
  else if (events.length > 20) bad('/api/events', `more than 20 events (${events.length})`)
  else {
    for (const e of events) {
      needKeys('/api/events[]', e, ['t', 'type', 'home_id', 'text', 'severity'])
      needEnum('/api/events type', e.type, EVENT_TYPES)
      needEnum('/api/events severity', e.severity, SEVERITIES)
    }
  }
}

const call = await get('/api/calls/current')
if (call) {
  needKeys('/api/calls/current', call, ['home_id', 'phase', 'source', 'language', 'transcript', 'extracted'])
  needEnum('/api/calls/current phase', call.phase, PHASES)
  needEnum('/api/calls/current source', call.source, SOURCES)
}

const acc = await get('/api/accuracy')
if (acc) {
  if (!Array.isArray(acc) || acc.length !== 4) bad('/api/accuracy', 'expected exactly 4 rows')
  else {
    for (const r of acc) {
      needKeys('/api/accuracy[]', r, ['horizon_min', 'k_source', 'mae_f', 'n'])
      needEnum('/api/accuracy horizon_min', r.horizon_min, [30, 60])
      needEnum('/api/accuracy k_source', r.k_source, ['learned', 'global'])
      if (r.n === 0 && r.mae_f !== null) bad('/api/accuracy', 'mae_f must be null when n is 0')
    }
  }
}

if (problems.length === 0) {
  console.log(`check:contract OK against ${base} (0 mismatches)`)
} else {
  console.log(`check:contract found ${problems.length} mismatch(es) against ${base}:`)
  for (const p of problems) console.log(' - ' + p)
  process.exitCode = 1
}
