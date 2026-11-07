/**
 * Phase 1 demo data for the SAVEL command dashboard.
 * Every timestamp is the scripted exercise clock below.
 * Do not replace these stamps with the laptop clock.
 *
 * Risk labels are stored on each home and rendered as written:
 * heated, cooling, warning, critical, leaving.
 */

export const SIM_CLOCK = {
  label: "18 Jan 2026 · 04:42 EST",
  date: "18 Jan 2026",
  time: "04:42 EST",
  iso: "2026-01-18T04:42:00-05:00",
  note: "Fixed exercise clock. Not the computer clock.",
}

export const RISK_META = {
  heated: { label: "heated", color: "#3cba8b" },
  cooling: { label: "cooling", color: "#6ea2ff" },
  warning: { label: "warning", color: "#e0a15a" },
  critical: { label: "critical", color: "#e15d5d" },
  leaving: { label: "leaving", color: "#f07a3a" },
}

export const LANGUAGE_LABELS = {
  en: "English",
  es: "Spanish",
  ar: "Arabic",
}

const BLOCKS = {
  A: { area: "West Side", origin: [42.924, -78.894] },
  B: { area: "South Buffalo", origin: [42.852, -78.818] },
  C: { area: "North Buffalo", origin: [42.954, -78.878] },
  D: { area: "East Side", origin: [42.896, -78.828] },
}

const PAST_LABELS = ["22:42", "23:42", "00:42", "01:42", "02:42", "03:42", "04:42"]
const FUTURE_LABELS = ["05:42", "06:42", "07:42", "08:42"]

const RISK_SEVERITY = {
  leaving: 0,
  critical: 1,
  warning: 2,
  cooling: 3,
  heated: 4,
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function hoursUntil(temp, threshold, rate, risk) {
  if (risk === "heated") return null
  if (temp <= threshold) return 0
  return round1((temp - threshold) / rate)
}

function blockPositions(originLat, originLon) {
  const positions = []
  for (let index = 0; index < 10; index += 1) {
    const row = Math.floor(index / 2)
    const col = index % 2
    const lat = Math.round((originLat - row * 0.0058) * 1e5) / 1e5
    const lon =
      Math.round((originLon + col * 0.0082 + (row % 2) * 0.0016) * 1e5) / 1e5
    positions.push([lat, lon])
  }
  return positions
}

const SPOTS = Object.fromEntries(
  Object.entries(BLOCKS).map(([block, info]) => [
    block,
    blockPositions(info.origin[0], info.origin[1]),
  ]),
)

function row(
  id,
  household,
  address,
  risk,
  temp_f,
  co_ppm,
  co_label,
  power_on,
  online,
  k_est,
  age_band,
  medical_needs,
  language,
  call_status,
  outcome,
  assistance_requested,
) {
  return {
    id,
    household,
    address,
    risk,
    temp_f,
    co_ppm,
    co_label,
    power_on,
    online,
    k_est,
    age_band,
    medical_needs,
    language,
    call_status,
    outcome,
    assistance_requested,
  }
}

const PROFILES = [
  row("A-01", "Rivera", "214 Brayton St", "leaving", 46.2, 6, "normal", false, true, 3.8, "80+", "oxygen", "es", "completed", "evacuating", true),
  row("A-02", "Nowak", "88 Hampshire St", "critical", 49.4, 28, "elevated", false, true, 3.2, "65-79", "mobility", "en", "in progress", "needs help", true),
  row("A-03", "Hassan", "401 Grant St", "critical", 50.8, 5, "normal", false, false, 2.9, "65-79", "insulin", "ar", "no answer", "needs help", true),
  row("A-04", "Bennett", "17 Potomac Ave", "warning", 55.4, 3, "normal", false, true, 2.2, "40-64", "none", "en", "queued", "monitoring", false),
  row("A-05", "Kowalski", "560 West Ferry St", "warning", 58.6, 2, "normal", false, true, 1.8, "80+", "cardiac", "en", "queued", "monitoring", false),
  row("A-06", "Adler", "93 Plymouth Ave", "cooling", 62.4, 1, "normal", false, true, 1.5, "40-64", "none", "en", "not started", "monitoring", false),
  row("A-07", "Brooks", "220 Lexington Ave", "cooling", 64.8, 1, "normal", false, true, 1.3, "18-39", "none", "en", "not started", "none", false),
  row("A-08", "Chen", "14 Days Park", "heated", 70.2, 0, "normal", true, true, 0.4, "40-64", "none", "en", "not started", "none", false),
  row("A-09", "Walsh", "333 Connecticut St", "heated", 72.5, 1, "normal", true, true, 0.3, "65-79", "none", "en", "not started", "none", false),
  row("A-10", "Ortiz", "77 Normal Ave", "heated", 68.4, 2, "normal", true, true, 0.5, "18-39", "none", "es", "not started", "none", false),

  row("B-01", "Petrov", "1800 South Park Ave", "leaving", 47.1, 7, "normal", false, true, 3.5, "80+", "cardiac", "en", "completed", "evacuating", true),
  row("B-02", "Nguyen", "42 Choate St", "critical", 51.6, 14, "elevated", false, true, 2.6, "65-79", "oxygen", "en", "in progress", "needs help", true),
  row("B-03", "Hall", "910 Abbott Rd", "warning", 57.0, 4, "normal", false, true, 2.1, "40-64", "mobility", "en", "queued", "monitoring", false),
  row("B-04", "Ibrahim", "15 Seneca St", "warning", 59.2, 3, "normal", false, false, 1.7, "40-64", "none", "ar", "no answer", "no contact", false),
  row("B-05", "Clark", "600 McKinley Pkwy", "cooling", 63.1, 1, "normal", false, true, 1.4, "65-79", "insulin", "en", "not started", "monitoring", false),
  row("B-06", "Rossi", "88 Hopkins St", "cooling", 65.4, 0, "normal", false, true, 1.2, "18-39", "none", "en", "not started", "none", false),
  row("B-07", "Green", "44 Tifft St", "cooling", 66.2, 2, "normal", true, true, 0.8, "40-64", "none", "en", "not started", "none", false),
  row("B-08", "Patel", "210 Elk St", "heated", 69.1, 1, "normal", true, true, 0.4, "40-64", "none", "en", "not started", "none", false),
  row("B-09", "Young", "9 Southside Pkwy", "heated", 73.0, 0, "normal", true, true, 0.2, "80+", "mobility", "en", "not started", "none", false),
  row("B-10", "Diaz", "1200 Bailey Ave", "heated", 71.4, 1, "normal", true, true, 0.3, "18-39", "none", "es", "not started", "none", false),

  row("C-01", "Murphy", "1400 Hertel Ave", "critical", 53.2, 4, "normal", false, true, 2.4, "80+", "oxygen", "en", "in progress", "needs help", true),
  row("C-02", "Ali", "88 Taunton Pl", "warning", 57.8, 2, "normal", false, true, 1.9, "65-79", "none", "en", "queued", "monitoring", false),
  row("C-03", "Baker", "310 Parker Ave", "warning", 60.4, 1, "normal", false, true, 1.6, "40-64", "none", "en", "not started", "monitoring", false),
  row("C-04", "Edwards", "22 Starin Ave", "cooling", 62.8, 1, "normal", false, true, 1.5, "18-39", "none", "en", "not started", "none", false),
  row("C-05", "Foster", "640 Colvin Ave", "cooling", 64.1, 0, "normal", false, true, 1.3, "40-64", "cardiac", "en", "not started", "monitoring", false),
  row("C-06", "Gray", "15 Linden Ave", "cooling", 65.0, 2, "normal", false, false, 1.2, "65-79", "none", "en", "no answer", "no contact", false),
  row("C-07", "Hughes", "400 Amherst St", "heated", 67.6, 1, "normal", true, true, 0.5, "40-64", "none", "en", "not started", "none", false),
  row("C-08", "Ivanov", "77 Virgil Ave", "heated", 70.8, 0, "normal", true, true, 0.3, "80+", "insulin", "en", "not started", "none", false),
  row("C-09", "Johnson", "12 Hartman Pl", "heated", 74.1, 1, "normal", true, true, 0.2, "18-39", "none", "en", "not started", "none", false),
  row("C-10", "Klein", "505 Delaware Ave", "heated", 69.5, 2, "normal", true, true, 0.4, "40-64", "none", "en", "not started", "none", false),

  row("D-01", "Lopez", "18 Fillmore Ave", "warning", 56.1, 6, "normal", false, true, 2.0, "65-79", "mobility", "es", "queued", "needs help", true),
  row("D-02", "Martin", "440 Broadway", "cooling", 63.6, 1, "normal", false, true, 1.4, "40-64", "none", "en", "not started", "monitoring", false),
  row("D-03", "Novak", "90 Sycamore St", "cooling", 64.4, 2, "normal", false, true, 1.3, "80+", "oxygen", "en", "not started", "monitoring", false),
  row("D-04", "Owens", "210 Walden Ave", "cooling", 66.0, 0, "normal", false, true, 1.1, "18-39", "none", "en", "not started", "none", false),
  row("D-05", "Price", "15 Urban St", "cooling", 62.2, 3, "normal", false, true, 1.6, "40-64", "none", "en", "not started", "none", false),
  row("D-06", "Quinn", "600 Genesee St", "heated", 68.8, 1, "normal", true, true, 0.4, "65-79", "cardiac", "en", "not started", "none", false),
  row("D-07", "Reed", "33 Doat St", "heated", 71.2, 0, "normal", true, true, 0.3, "40-64", "none", "en", "not started", "none", false),
  row("D-08", "Santos", "120 Strauss St", "heated", 72.0, 1, "normal", true, false, 0.3, "18-39", "none", "en", "not started", "none", false),
  row("D-09", "Turner", "8 Herman St", "heated", 69.8, 2, "normal", true, true, 0.4, "80+", "none", "en", "not started", "none", false),
  row("D-10", "Underwood", "250 Kensington Ave", "heated", 73.4, 0, "normal", true, true, 0.2, "40-64", "none", "en", "not started", "none", false),
]

const usedSpots = { A: 0, B: 0, C: 0, D: 0 }

export const MOCK_HOMES = PROFILES.map((profile) => {
  const block = profile.id[0]
  const spotIndex = usedSpots[block]
  usedSpots[block] += 1
  const [lat, lon] = SPOTS[block][spotIndex]
  const last_actual_index = profile.online ? PAST_LABELS.length - 1 : 4

  return {
    ...profile,
    block,
    area: BLOCKS[block].area,
    city: "Buffalo, NY",
    lat,
    lon,
    status: profile.risk,
    battery: profile.online,
    hours_to_60: hoursUntil(profile.temp_f, 60, profile.k_est, profile.risk),
    hours_to_50: hoursUntil(profile.temp_f, 50, profile.k_est, profile.risk),
    last_actual_index,
    last_reading: `${PAST_LABELS[last_actual_index]} EST`,
  }
})

function assertMockData() {
  if (MOCK_HOMES.length !== 40) {
    throw new Error(`SAVEL mock data expected 40 homes, received ${MOCK_HOMES.length}.`)
  }

  for (const block of ["A", "B", "C", "D"]) {
    const count = MOCK_HOMES.filter((home) => home.block === block).length
    if (count !== 10) {
      throw new Error(`Block ${block} expected 10 homes, received ${count}.`)
    }
  }

  for (const home of MOCK_HOMES) {
    if (!RISK_META[home.risk]) {
      throw new Error(`Home ${home.id} has an unknown risk label.`)
    }
  }
}

assertMockData()

export function rankHomes(homes) {
  return [...homes].sort((a, b) => {
    const byRisk = RISK_SEVERITY[a.risk] - RISK_SEVERITY[b.risk]
    if (byRisk !== 0) return byRisk

    if (a.hours_to_50 == null && b.hours_to_50 != null) return 1
    if (b.hours_to_50 == null && a.hours_to_50 != null) return -1
    if (a.hours_to_50 != null && b.hours_to_50 != null && a.hours_to_50 !== b.hours_to_50) {
      return a.hours_to_50 - b.hours_to_50
    }
    if (a.temp_f !== b.temp_f) return a.temp_f - b.temp_f
    return a.id.localeCompare(b.id)
  })
}

export function summarize(homes) {
  return {
    monitored: homes.length,
    critical: homes.filter((home) => home.risk === "critical").length,
    leaving: homes.filter((home) => home.risk === "leaving").length,
    outages: homes.filter((home) => home.power_on === false).length,
    assistance: homes.filter((home) => home.assistance_requested).length,
    offline: homes.filter((home) => home.online === false).length,
  }
}

function sensorWobble(id, index) {
  let seed = 0
  for (const char of id) seed += char.charCodeAt(0)
  return ((seed + index * 3) % 5 - 2) * 0.12
}

export function temperatureSeries(home) {
  const rate = home.risk === "heated" ? 0 : home.k_est
  const last = home.last_actual_index
  const points = PAST_LABELS.map((label, index) => {
    let actual = null
    if (index < last) {
      actual = round1(home.temp_f + rate * (last - index) + sensorWobble(home.id, index))
    } else if (index === last) {
      actual = home.temp_f
    }

    const predicted =
      index >= last ? round1(home.temp_f - rate * (index - last)) : null

    return { label, actual, predicted }
  })

  FUTURE_LABELS.forEach((label, index) => {
    const steps = PAST_LABELS.length - 1 - last + index + 1
    points.push({
      label,
      actual: null,
      predicted: round1(home.temp_f - rate * steps),
    })
  })

  return points
}

export function formatHours(hours) {
  if (hours == null) return "Not counting down"
  if (hours === 0) return "Crossed"
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours.toFixed(1)} h`
}
