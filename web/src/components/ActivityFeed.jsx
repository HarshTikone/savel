import { simClock } from '../lib/format'

export default function ActivityFeed({ events = [], onSelect, limit = 8 }) {
  const list = events.filter((e) => e && e.type !== 'reset').slice(0, limit)
  if (list.length === 0) return <p className="muted">Nothing yet. Cut power to a house on the Simulation page.</p>
  return (
    <ul className="feed">
      {list.map((e, i) => (
        <li key={`${e.t}-${i}`} className={`feed-item ${e.severity}`}>
          <span className="feed-time mono">{simClock(e.t)}</span>
          {e.home_id ? (
            <button type="button" className="linklike" onClick={() => onSelect && onSelect(e.home_id)}>{e.text}</button>
          ) : <span>{e.text}</span>}
        </li>
      ))}
    </ul>
  )
}
