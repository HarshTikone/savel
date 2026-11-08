import { STATUS_META } from '../data/contract'
import { homeColor } from '../lib/colors'

export default function StatusPill({ home, size = 'md' }) {
  if (!home) return null
  const meta = STATUS_META[home.status] || { label: home.status }
  const Icon = meta.icon
  const color = homeColor(home)
  return (
    <span className={`status-pill ${size}`} style={{ '--c': color }}>
      {Icon && <Icon size={size === 'lg' ? 16 : 13} />} {meta.label}
    </span>
  )
}
