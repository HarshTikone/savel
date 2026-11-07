// Hex values mirror the tokens in tokens.css (Leaflet and SVG need literal colors).
export const STATUS_COLOR = {
  heated: '#ff7a3d',
  cooling: '#8c6b50',
  warning: '#4c8cc6',
  critical: '#cfe6fa',
  leaving: '#7fd3a0',
}
export const ALARM = '#ff5c8a'
export const SELECTED = '#ffffff'
export const OUTLINE = '#26384e'

// Display-only styling from backend status and flags.
export function markerStyle(home, selected = false) {
  const fill = STATUS_COLOR[home.status] || '#8fa1b5'
  const offline = home.online === false
  let stroke = '#0b1420'
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
