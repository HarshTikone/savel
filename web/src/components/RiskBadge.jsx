import { STATUS } from '../data/mockHomes'
export default function RiskBadge({ status, compact = false }) {
  const label = STATUS[status]?.label ?? String(status || 'Unknown')
  return <span className={`risk-badge risk-${status || 'unknown'} ${compact ? 'risk-compact' : ''}`}>
    <span aria-hidden="true" className="risk-swatch" />{label}
  </span>
}
