// Hex values mirror the tokens in tokens.css (Leaflet and SVG need literal colors).
export const STATUS_COLOR = {
  heated: '#22c55e',
  cooling: '#facc15',
  warning: '#fb923c',
  critical: '#ef4444',
  leaving: '#94a3b8',
  recovering: '#38bdf8',
}
export const ALARM = '#ef4444'
export const SELECTED = '#3b82f6'
export const OUTLINE = '#3a3a3a'

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// A recovering home fades from orange to green as it warms back up (48F -> 62F).
export function homeColor(home) {
  if (!home) return '#a1a1aa'
  if (home.status === 'recovering') {
    const t = Math.max(0, Math.min(1, ((home.temp_f ?? 48) - 48) / 14))
    return mix(STATUS_COLOR.warning, STATUS_COLOR.heated, t)
  }
  return STATUS_COLOR[home.status] || '#a1a1aa'
}

// Display-only styling from backend status and flags.
export function markerStyle(home, selected = false) {
  const fill = homeColor(home)
  const offline = home.online === false
  let stroke = '#111111'
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
