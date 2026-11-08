// Hex values mirror the tokens in tokens.css (Leaflet and SVG need literal colors).
export const STATUS_COLOR = {
  heated: '#22c55e',
  cooling: '#facc15',
  warning: '#fb923c',
  critical: '#ef4444',
  leaving: '#a78bfa',
  recovering: '#38bdf8',
}
export const ALARM = '#ef4444'
export const SELECTED = '#ffffff'
export const OUTLINE = '#22304a'

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// A recovering home fades from orange to green as it warms back up (48°F -> 62°F).
export function homeColor(home) {
  if (!home) return '#8d9ab0'
  if (home.status === 'recovering') {
    const t = Math.max(0, Math.min(1, ((home.temp_f ?? 48) - 48) / 14))
    return mix(STATUS_COLOR.warning, STATUS_COLOR.heated, t)
  }
  return STATUS_COLOR[home.status] || '#8d9ab0'
}

// Display-only styling from backend status and flags.
export function markerStyle(home, selected = false) {
  const fill = homeColor(home)
  const offline = home.online === false
  let stroke = '#0a0f1a'
  let weight = 1.5
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
    fillOpacity: offline ? 0.12 : 0.95,
    dashArray: offline ? '4 3' : undefined,
  }
}
