import { PhoneCall, Phone, PhoneOff, CheckCircle2, HeartPulse, Bot, Mic, MapPin, Activity } from 'lucide-react'
import { useCalls } from '../hooks/useCalls'
import { OUTCOME_LABEL } from '../data/contract'
import { IncomingCall } from '../components/CallPanel'
import StatusPill from '../components/StatusPill'
import { temp } from '../lib/format'

const ACTIVE = ['ringing', 'in_call', 'extracting']
const PHASE_LABEL = { ringing: 'Ringing', in_call: 'On the call', extracting: 'Reading the answers', done: 'Done', no_answer: 'No answer' }
const BLOCKS = ['A', 'B', 'C', 'D']

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <li className={`tile ${tone || ''}`}>
      <Icon size={16} />
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </li>
  )
}

export default function AgentPage({ data, voice }) {
  const { homes, call, runId } = data
  const calls = useCalls(runId)
  const byId = Object.fromEntries(homes.map((h) => [h.id, h]))
  const withHome = calls.map((c) => ({ ...c, home: byId[c.home_id] }))
  const active = withHome.filter((c) => ACTIVE.includes(c.phase))
  const finished = withHome.filter((c) => !ACTIVE.includes(c.phase))
  const count = (f) => withHome.filter(f).length

  const areas = BLOCKS.map((b) => {
    const inBlock = withHome.filter((c) => c.home && c.home.block === b)
    return {
      block: b,
      active: inBlock.filter((c) => ACTIVE.includes(c.phase)).length,
      done: inBlock.filter((c) => !ACTIVE.includes(c.phase)).length,
      help: inBlock.filter((c) => ['needs_help', 'medical', 'unreachable'].includes(c.outcome)).length,
    }
  })
  const areasNow = areas.filter((a) => a.active > 0).length

  return (
    <div className="page agent">
      <div className="incoming-slot"><IncomingCall call={call} voice={voice} /></div>
      <ul className="tiles six">
        <Kpi icon={Activity} label="Calling right now" value={active.length} tone={active.length ? 'live' : ''} />
        <Kpi icon={MapPin} label="Areas being called" value={areasNow} />
        <Kpi icon={PhoneCall} label="Ringing" value={count((c) => c.phase === 'ringing')} />
        <Kpi icon={CheckCircle2} label="Calls completed" value={count((c) => c.phase === 'done')} />
        <Kpi icon={HeartPulse} label="Need help or medical" value={count((c) => ['needs_help', 'medical'].includes(c.outcome))} tone={count((c) => ['needs_help', 'medical'].includes(c.outcome)) ? 'bad' : ''} />
        <Kpi icon={PhoneOff} label="No answer" value={count((c) => c.outcome === 'unreachable')} tone={count((c) => c.outcome === 'unreachable') ? 'bad' : ''} />
      </ul>

      <div className="a-grid">
        <section className="card" aria-label="Calls in progress">
          <div className="card-head"><h2>Calling right now</h2><span className="muted">{active.length} at once</span></div>
          {active.length === 0 ? (
            <div className="empty"><Phone size={22} /><p>The agent is idle. Calls start when a house drops below 60°F and keeps falling.</p></div>
          ) : (
            <ul className="live-list">
              {active.map((c) => (
                <li key={c.home_id} className={`live-item ${c.phase}`}>
                  <span className="live-icon">{c.phase === 'ringing' ? <PhoneCall size={18} /> : <Phone size={18} />}</span>
                  <span className="live-main">
                    <span className="live-top">
                      <strong>{c.home_id}</strong>
                      <span className="muted">Block {c.home ? c.home.block : '?'}</span>
                      <span className="src">{c.source === 'live' ? <><Mic size={11} /> Live voice</> : <><Bot size={11} /> AI call</>}</span>
                    </span>
                    <span className="live-phase">{PHASE_LABEL[c.phase]}{c.home ? ` · ${temp(c.home.temp_f)}` : ''}</span>
                    {c.last && <span className="live-last">{c.last}</span>}
                  </span>
                  {c.home && <StatusPill home={c.home} size="sm" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-label="Calls by area">
          <h2>By area</h2>
          <ul className="areas">
            {areas.map((a) => (
              <li key={a.block} className={`area${a.active ? ' busy' : ''}`}>
                <span className="area-name">Block {a.block}</span>
                <span className="area-stat"><b>{a.active}</b> calling</span>
                <span className="area-stat"><b>{a.done}</b> done</span>
                <span className={`area-stat${a.help ? ' bad' : ''}`}><b>{a.help}</b> need help</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card a-wide" aria-label="Finished calls">
          <div className="card-head"><h2>Finished calls</h2><span className="muted">{finished.length}</span></div>
          {finished.length === 0 ? <p className="muted">No finished calls yet.</p> : (
            <table className="calls-table">
              <thead><tr><th>House</th><th>Area</th><th>Type</th><th>Result</th><th>Temperature</th></tr></thead>
              <tbody>
                {finished.map((c) => (
                  <tr key={c.home_id}>
                    <td><strong>{c.home_id}</strong></td>
                    <td>Block {c.home ? c.home.block : '?'}</td>
                    <td>{c.source === 'live' ? 'Live voice' : 'AI call'}</td>
                    <td className={['needs_help', 'medical', 'unreachable'].includes(c.outcome) ? 'bad' : 'ok'}>{OUTCOME_LABEL[c.outcome] || PHASE_LABEL[c.phase]}</td>
                    <td>{c.home ? temp(c.home.temp_f) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
