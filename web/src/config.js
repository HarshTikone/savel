export const POLL_MS = 2000
export const HEALTH_MS = 5000
export const STALE_AFTER_FAILS = 2
export const SPEED_PRESETS = [
  { value: 30, label: '0.5 storm min/s' },
  { value: 300, label: '5 storm min/s (demo)' },
  { value: 600, label: '10 storm min/s' },
]
export const VENT_HOME = 'H-27'
export const QUEUE_SIZE = 10
export const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'live'
