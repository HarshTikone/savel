export const POLL_MS = 2000
export const HEALTH_MS = 5000
export const STALE_AFTER_FAILS = 2
export const SPEED_PRESETS = [
  { value: 30, label: 'Slow · report every 20 s' },
  { value: 60, label: 'Demo · report every 10 s' },
  { value: 150, label: 'Fast · report every 4 s' },
]
export const VENT_HOME = 'H-27'
export const QUEUE_SIZE = 10
export const DATA_MODE = import.meta.env.VITE_DATA_MODE || 'live'
export const ELEVEN_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'agent_5001m6xdg56afh2tt2d4e7tn7463'
export const ELEVEN_CLIENT_URL = 'https://esm.sh/@elevenlabs/client@1.35.0'
