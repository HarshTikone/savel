import { stormDuration, temp as fmtTemp } from './format'

// The demo story for one house, in order. Each step is reached from backend data only.
export const STORY_STEPS = [
  { key: 'cut', label: 'Power cut' },
  { key: 'cooling', label: 'Cooling detected' },
  { key: 'threshold', label: 'Threshold crossed' },
  { key: 'call', label: 'AI check-in call' },
  { key: 'ranked', label: 'Ranked #1' },
  { key: 'help', label: 'Help delivered' },
  { key: 'normal', label: 'Back to normal' },
]

export function rankOf(homes, id) {
  const ranked = rankedHomes(homes)
  const i = ranked.findIndex((h) => h.id === id)
  return i < 0 ? null : i + 1
}

// Who needs attention, most urgent first. Same order as the backend risk score.
export function rankedHomes(homes) {
  return [...homes]
    .filter((h) => h.risk > 0 && h.outcome !== 'helped' && h.status !== 'heated')
    .sort((a, b) => b.risk - a.risk || (a.hours_to_50 ?? 99) - (b.hours_to_50 ?? 99) || a.id.localeCompare(b.id))
}

function hasEvent(events, type, id) {
  return (events || []).some((e) => e && e.type === type && e.home_id === id)
}

// Only events since this house's latest power cut count (events are newest first).
export function eventsSinceCut(events, id) {
  const list = events || []
  const i = list.findIndex((e) => e && e.type === 'house_power_cut' && e.home_id === id)
  return i < 0 ? list : list.slice(0, i + 1)
}

// Steps reached right now (the hook keeps them sticky).
export function reachedNow(home, rank, events) {
  if (!home) return new Set()
  const id = home.id
  events = eventsSinceCut(events, id)
  const r = new Set()
  if (home.power_on === false || hasEvent(events, 'house_power_cut', id)) r.add('cut')
  if (!home.heating && (home.trend === 'falling' || ['warning', 'critical'].includes(home.status))) r.add('cooling')
  if (['warning', 'critical'].includes(home.status) || hasEvent(events, 'threshold', id)) r.add('threshold')
  if (['ringing', 'in_call', 'done', 'no_answer', 'unreachable'].includes(home.call_status) || hasEvent(events, 'call_started', id)) r.add('call')
  if (rank === 1 && ['warning', 'critical'].includes(home.status)) r.add('ranked')
  if (home.outcome === 'helped') r.add('help')
  if (home.outcome === 'helped' && home.status === 'heated') r.add('normal')
  return r
}

export function stepDetail(key, home, rank) {
  if (!home) return ''
  switch (key) {
    case 'cut': return home.power_on === false ? 'No power at the house' : 'Power is back'
    case 'cooling': return home.slope_f_per_h != null ? `Falling ${Math.abs(home.slope_f_per_h).toFixed(1)}°F/h · ${fmtTemp(home.temp_f)}` : fmtTemp(home.temp_f)
    case 'threshold': return home.status === 'critical' ? `Below 50°F · ${fmtTemp(home.temp_f)}` : home.hours_to_50 != null ? `Below 60°F · 50°F in ${stormDuration(home.hours_to_50)}` : `Below 60°F · ${fmtTemp(home.temp_f)}`
    case 'call': return { none: 'Waiting', queued: 'Queued', ringing: 'Ringing', in_call: 'On the call', done: 'Answered', no_answer: 'No answer', unreachable: 'Unreachable' }[home.call_status] || ''
    case 'ranked': return rank ? `Priority #${rank}` : ''
    case 'help': return home.outcome === 'helped' ? 'Responder on site, power restored' : ''
    case 'normal': return home.status === 'heated' ? fmtTemp(home.temp_f) : home.status === 'recovering' ? `Warming · ${fmtTemp(home.temp_f)}` : ''
    default: return ''
  }
}
