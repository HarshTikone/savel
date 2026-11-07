const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})

export function simClock(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : clockFmt.format(d)
}

export function stormDuration(hours) {
  if (hours === null || hours === undefined) return '—'
  if (hours <= 0) return 'now'
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export const temp = (f) => (f === null || f === undefined ? 'Unavailable' : `${f.toFixed(1)}°F`)
export const ppm = (x) => (x === null || x === undefined ? 'Unavailable' : `${Math.round(x)} ppm`)

export function speedLabel(speed) {
  if (speed === null || speed === undefined) return '—'
  return `${+(speed / 60).toFixed(2)} storm min/s`
}
