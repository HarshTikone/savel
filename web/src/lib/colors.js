// Hex values mirror the Verdana Health tokens in tokens.css (Leaflet and SVG need literal colors).
export const STATUS_COLOR = {
  heated: '#22c55e',     // success
  cooling: '#eab308',    // warning (caution)
  warning: '#ea580c',    // below 60F and falling
  critical: '#ef4444',   // error
  leaving: '#64748b',    // slate: safe, on their way
  recovering: '#0ea5e9', // info: power back, warming
}
export const ALARM = '#ef4444'
export const SELECTED = '#0F172A'
export const OUTLINE = '#CBD5E1'

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// A recovering home fades from orange to green as it warms back up (48F -> 62F).
export function homeColor(home) {
  if (!home) return '#64748b'
  if (home.status === 'recovering') {
    const t = Math.max(0, Math.min(1, ((home.temp_f ?? 48) - 48) / 14))
    return mix(STATUS_COLOR.warning, STATUS_COLOR.heated, t)
  }
  return STATUS_COLOR[home.status] || '#64748b'
}

// Display-only styling from backend status and flags.
export function markerStyle(home, selected = false) {
  const fill = homeColor(home)
  const offline = home.online === false
  let stroke = '#FFFFFF'
  let weight = 2
  if (home.status === 'critical') {
    stroke = ALARM
    weight = 4
  }
  if (selected) {
    stroke = SELECTED
    weight = 4
  }
  return {
    color: stroke,
    weight,
    fillColor: fill,
    fillOpacity: offline ? 0.25 : 0.95,
    dashArray: offline ? '4 3' : undefined,
  }
}
