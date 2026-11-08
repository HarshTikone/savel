import { STATUS_META, CALL_STATUS_LABEL, OUTCOME_LABEL } from '../data/contract'
import { ppm, stormDuration, temp } from '../lib/format'

const UNAVAILABLE = 'Unavailable'

const kSource = (s) => (s === 'learned' ? 'learned' : s === 'median' ? 'neighborhood median' : null)

function hoursTo(h) {
  if (h === null || h === undefined) return UNAVAILABLE
  return h === 0 ? 'passed' : stormDuration(h)
}

export default function HomeDetails({ home, selectedId }) {
  if (!selectedId) return <p className="muted">Select a home on the map or in the queue.</p>
  if (!home) return <p className="muted">Home not in current run.</p>

  const meta = STATUS_META[home.status]
  const Icon = meta.icon
  const src = kSource(home.k_source)
  const k = home.k_est === null || home.k_est === undefined ? UNAVAILABLE : `${home.k_est}${src ? ` (${src})` : ''}`

  const rows = [
    ['Temperature', temp(home.temp_f)],
    ['Carbon monoxide', ppm(home.co_ppm)],
    ['Power', home.power_on ? 'On' : 'Off'],
    ['Heating', home.heating ? 'On' : 'Off'],
    ['Sensor', home.online ? 'Online' : 'Offline (estimated)'],
    ['Insulation k', k],
    ['Hours to 60°F', hoursTo(home.hours_to_60)],
    ['Hours to 50°F', hoursTo(home.hours_to_50)],
    ['Age band', home.age_band || UNAVAILABLE],
    ['Medical needs', home.medical_needs && home.medical_needs.length ? home.medical_needs.join(', ') : 'None listed'],
    ['Language', home.language || UNAVAILABLE],
    ['Call', CALL_STATUS_LABEL[home.call_status] ?? home.call_status],
    ['Outcome', OUTCOME_LABEL[home.outcome] ?? home.outcome],
  ]

  return (
    <div className="details">
      <div className="details-head">
        <strong className="details-id">{home.id}</strong>
        <span className="muted">Block {home.block}</span>
        <span className="status-chip" style={{ color: `var(${meta.colorVar})` }}>
          <Icon size={14} aria-hidden="true" /> {meta.label}
        </span>
      </div>
      <dl className="details-grid">
        {rows.map(([label, value]) => (
          <div key={label} className="details-row">
            <dt>{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
