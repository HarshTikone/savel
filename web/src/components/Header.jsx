import { simClock, speedLabel } from '../lib/format'

const CONNECTION = {
  live: { text: 'LIVE', cls: 'live' },
  mock: { text: 'MOCK', cls: 'mock' },
  stale: { text: 'STALE · RECONNECTING', cls: 'stale' },
  unavailable: { text: 'API UNAVAILABLE', cls: 'down' },
  connecting: { text: 'CONNECTING', cls: 'stale' },
}

export default function Header({ state, connection, demoLayout, onToggleDemo, extra }) {
  const conn = CONNECTION[connection] || CONNECTION.connecting
  return (
    <header className="header">
      <div className="brand">
        <span className="wordmark">SAVEL</span>
        <span className="pill sim">SIMULATION</span>
        <span className={`pill conn ${conn.cls}`} role="status">{conn.text}</span>
      </div>
      <div className="header-stats mono">
        <span title="Simulated time">{state ? simClock(state.sim_now) : '—'}</span>
        <span>Outdoor {state ? `${state.outdoor_f}°F` : '—'}</span>
        <span>{state ? speedLabel(state.speed) : '—'}</span>
        {state && state.live_call && <span className="pill slowed">Slowed for live call</span>}
        {extra}
        <button type="button" className="btn" onClick={onToggleDemo} aria-pressed={demoLayout}>
          {demoLayout ? 'Full layout' : 'Demo layout'}
        </button>
      </div>
    </header>
  )
}
