// SAVEL Phase 1 fixture data. All homes, details, and readings are synthetic.
// Do not label these as live measurements or actual resident data.
export const SIM_NOW = '2026-01-17T13:40:00-05:00'
export const STATUS = {
  heated: { label: 'Heated', tone: 'ember' },
  cooling: { label: 'Cooling', tone: 'blue' },
  warning: { label: 'Warning', tone: 'warning' },
  critical: { label: 'Critical', tone: 'critical' },
  leaving: { label: 'Leaving', tone: 'leaving' },
}

const blocks = {
  A: [42.936, -78.877],
  B: [42.914, -78.843],
  C: [42.888, -78.887],
  D: [42.874, -78.842],
}
const healthNeeds = ['None reported', 'None reported', 'Limited mobility', 'Oxygen equipment', 'None reported', 'Medication refrigeration']
const ageBands = ['18–39', '40–64', '65+', '40–64', '65+']
const langs = ['English', 'English', 'Spanish', 'English', 'Arabic']

function generatedHome(i) {
  const index = i - 1
  const block = 'ABCD'[Math.floor(index / 10)]
  const position = index % 10
  const [baseLat, baseLon] = blocks[block]
  const hasPower = index % 4 === 0 || index % 7 === 0
  const offline = index % 13 === 0
  let temperature = 65 - (index * 11 % 24) - (hasPower ? -4 : 0)
  if (temperature > 69) temperature = 69
  let co = index % 17 === 6 ? 62 : index % 19 === 9 ? 36 : index % 7 === 2 ? 5 : 0
  let hours = Math.max(0.3, Number(((temperature - 50) / (3.5 + index % 5)).toFixed(1)))
  let status = temperature < 50 || hours < 1.5 || co >= 35 ? 'critical' :
    temperature < 60 || hours < 4 ? 'warning' : hasPower ? 'heated' : 'cooling'
  if (index === 31) status = 'leaving'
  const risk = Math.min(99, Math.max(6, Math.round((70 - temperature) * 2.1 + (co >= 35 ? 38 : 0) + (!hasPower ? 8 : 0) + (index % 5) * 3)))
  return {
    id: `H-${String(i).padStart(2, '0')}`,
    block,
    lat: baseLat + (position % 5 - 2) * 0.0036 + Math.floor(position / 5) * 0.001,
    lon: baseLon + (Math.floor(position / 5) - 0.5) * 0.007 + (position % 5 - 2) * 0.001,
    temp_f: temperature,
    co_ppm: co,
    power_on: hasPower,
    online: !offline,
    k_est: Number((0.07 + index % 8 * 0.009).toFixed(3)),
    hours_to_60: temperature <= 60 ? 0 : Number(((temperature - 60) / 4.5).toFixed(1)),
    hours_to_50: hours,
    risk,
    status,
    call_status: index % 11 === 6 ? 'completed' : index % 8 === 3 ? 'queued' : index % 13 === 0 ? 'no_answer' : 'not_called',
    outcome: index % 11 === 6 ? 'Assistance requested' : null,
    age_band: ageBands[index % ageBands.length],
    medical_needs: healthNeeds[index % healthNeeds.length],
    language: langs[index % langs.length],
  }
}

export const mockHomes = Array.from({ length: 40 }, (_, i) => generatedHome(i + 1))

export function getSummary(homes) {
  return {
    monitored: homes.length,
    critical: homes.filter(h => h.status === 'critical').length,
    warning: homes.filter(h => h.status === 'warning').length,
    outages: homes.filter(h => !h.power_on).length,
    assistance: homes.filter(h => h.outcome === 'Assistance requested').length,
  }
}

export function formatSimTime(iso) {
  if (!iso) return 'Unavailable'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(dt)
}

export function createMockSeries(home) {
  const base = new Date(SIM_NOW).getTime()
  const hourlyDrop = home.power_on ? 0.35 : 3.2 + ((Number(home.id.slice(-2)) % 5) * 0.7)
  return Array.from({ length: 17 }, (_, i) => {
    const minutes = (i - 8) * 15
    const timestamp = new Date(base + minutes * 60000).toISOString()
    const delta = (minutes / 60) * hourlyDrop
    const temp = Number((home.temp_f - delta + (minutes <= 0 ? Math.sin(i * 1.3) * 0.18 : 0)).toFixed(1))
    return {
      t: formatSimTime(timestamp),
      observed: minutes <= 0 && !(home.online === false && minutes >= -30) ? temp : null,
      estimated: minutes <= 0 && home.online === false && minutes >= -30 ? temp : null,
      predicted: minutes >= 0 ? temp : null,
    }
  })
}

export const mockCall = {
  home_id: 'H-07', source: 'scripted', phase: 'done', language: 'English',
  transcript: [
    { speaker: 'SAVEL demo agent', text: 'This is a simulated welfare check. Is your heat working?' },
    { speaker: 'Synthetic resident', text: 'No. The power went out, and I need help with oxygen equipment.' },
    { speaker: 'SAVEL demo agent', text: 'Thank you. Your response will be flagged for review by a human operator.' },
  ],
  extracted: { has_heat: false, needs_help: true, medical_issue: true, can_leave: false },
}

export const mockEvents = [
  { t: '2026-01-17T13:40:00-05:00', type: 'RISK', home_id: 'H-07', text: 'CO reading exceeded simulated threshold', severity: 'critical' },
  { t: '2026-01-17T13:36:00-05:00', type: 'CALL', home_id: 'H-07', text: 'Scripted check-in completed; assistance requested', severity: 'warning' },
  { t: '2026-01-17T13:32:00-05:00', type: 'POWER', home_id: null, text: 'Block B simulated power outage', severity: 'warning' },
  { t: '2026-01-17T13:27:00-05:00', type: 'FORECAST', home_id: 'H-18', text: 'Predicted cooling threshold approaching', severity: 'info' },
  { t: '2026-01-17T13:19:00-05:00', type: 'SENSOR', home_id: 'H-27', text: 'Sensor offline; last estimate retained', severity: 'info' },
  { t: '2026-01-17T13:07:00-05:00', type: 'SYSTEM', home_id: null, text: 'Simulation dataset initialized: 40 synthetic homes', severity: 'info' },
]
