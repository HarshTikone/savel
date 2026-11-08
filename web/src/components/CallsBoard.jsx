import { Phone, PhoneOff, PhoneCall, Bot, Mic } from 'lucide-react'
import { OUTCOME_LABEL } from '../data/contract'

const PHASE = {
  ringing: { label: 'Ringing', icon: PhoneCall, tone: 'ring' },
  in_call: { label: 'On the call', icon: Phone, tone: 'live' },
  extracting: { label: 'Reading the answers', icon: Phone, tone: 'live' },
  done: { label: 'Done', icon: Phone, tone: 'done' },
  no_answer: { label: 'No answer', icon: PhoneOff, tone: 'bad' },
}

export default function CallsBoard({ calls, selectedId, onSelect }) {
  if (!calls || calls.length === 0) return null
  const active = calls.filter((c) => ['ringing', 'in_call', 'extracting'].includes(c.phase)).length
  return (
    <section className="card calls-board" aria-label="Check-in calls">
      <div className="card-head">
        <h2>Check-in calls</h2>
        <span className="muted">{active ? `${active} in progress · ` : ''}{calls.length} house{calls.length === 1 ? '' : 's'} called</span>
      </div>
      <ul className="calls-row">
        {calls.map((c) => {
          const p = PHASE[c.phase] || PHASE.done
          const res = c.result || (c.outcome && !['none', 'helped'].includes(c.outcome) ? c.outcome : null)
          const outcome = res ? OUTCOME_LABEL[res] : null
          return (
            <li key={c.home_id}>
              <button type="button" className={`call-card ${p.tone}${c.home_id === selectedId ? ' selected' : ''}`} onClick={() => onSelect(c.home_id)}>
                <span className="call-card-top">
                  <strong>{c.home_id}</strong>
                  <span className="src">{c.source === 'live' ? <><Mic size={11} /> Live</> : <><Bot size={11} /> Auto</>}</span>
                </span>
                <span className="call-card-phase"><p.icon size={13} /> {p.label}{c.phase === 'ringing' && c.ring_left_s != null ? ` · ${c.ring_left_s}s` : ''}</span>
                {outcome && <span className={`call-card-out ${['needs_help', 'medical', 'unreachable'].includes(res) ? 'bad' : ''}`}>{outcome}</span>}
                {c.outcome === 'helped' && <span className="call-card-out">✓ Help delivered</span>}
                {!res && c.phase === 'done' && c.outcome !== 'helped' && /cancelled/i.test(c.last || '') && <span className="call-card-phase">Cancelled · heat is back</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
