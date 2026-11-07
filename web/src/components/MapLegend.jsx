import { STATUSES, STATUS_META } from '../data/contract'
import { STATUS_COLOR } from '../lib/colors'

export default function MapLegend() {
  return (
    <ul className="legend" aria-label="Map legend">
      {STATUSES.map((s) => {
        const meta = STATUS_META[s]
        const Icon = meta.icon
        return (
          <li key={s} className="legend-item">
            <span className="swatch" style={{ background: STATUS_COLOR[s] }} />
            <Icon size={14} aria-hidden="true" />
            <span>{meta.label}</span>
          </li>
        )
      })}
      <li className="legend-item">
        <span className="swatch offline" />
        <span>Sensor offline (estimated)</span>
      </li>
    </ul>
  )
}
