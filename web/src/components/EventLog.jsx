import { SEVERITY_META } from '../data/contract'
import { simClock } from '../lib/format'

const valid = (e) => e && typeof e === 'object' && typeof e.text === 'string' && e.t

export default function EventLog({ events, onSelect }) {
  const list = (events || []).filter(valid).slice(0, 20)
  if (list.length === 0) return <p className="muted">No events yet.</p>
  return (
    <ul className="events">
      {list.map((e, i) => {
        const meta = SEVERITY_META[e.severity] || SEVERITY_META.info
        const Icon = meta.icon
        const body = (
          <>
            <span className="mono muted">{simClock(e.t)}</span>
            <Icon size={14} aria-hidden="true" style={{ color: `var(${meta.colorVar})` }} />
            <span>{e.text}</span>
          </>
        )
        return (
          <li key={`${e.t}-${e.type}-${e.home_id}-${i}`} style={{ borderLeft: `3px solid var(${meta.colorVar})` }}>
            {e.home_id ? (
              <button type="button" className="event-btn" onClick={() => onSelect(e.home_id)}>{body}</button>
            ) : (
              <div className="event-btn static">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
