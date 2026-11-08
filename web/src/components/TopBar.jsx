import { Activity, Radio, SlidersHorizontal } from 'lucide-react'
import { simClock, speedLabel } from '../lib/format'

export default function TopBar({ page, state, connection }) {
  const conn = { live: 'Live', mock: 'Mock data', stale: 'Reconnecting', down: 'Backend down' }[connection] || connection
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true"><Activity size={18} /></span>
        <span className="wordmark">SAVEL</span>
        <span className="tagline">Winter outage response</span>
      </div>
      <nav className="tabs" aria-label="Pages">
        <a href="#/" className={page === 'responder' ? 'active' : ''} aria-current={page === 'responder' ? 'page' : undefined}>
          <Radio size={15} /> Responder
        </a>
        <a href="#/sim" className={page === 'sim' ? 'active' : ''} aria-current={page === 'sim' ? 'page' : undefined}>
          <SlidersHorizontal size={15} /> Simulation
        </a>
      </nav>
      <div className="topbar-right">
        <span className="clock" title="Simulated storm time">{state ? simClock(state.sim_now) : '—'}</span>
        <span className="muted">{state ? speedLabel(state.speed) : ''}</span>
        {state && state.live_call && <span className="badge info">Slowed for live call</span>}
        <span className={`conn ${connection}`}><span className="dot" />{conn}</span>
      </div>
    </header>
  )
}
