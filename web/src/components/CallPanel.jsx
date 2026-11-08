import { Phone, PhoneOff } from 'lucide-react'
import { PHASES } from '../data/contract'
import { simClock } from '../lib/format'

const PHASE_LABEL = { ringing: 'Ringing', in_call: 'In call', extracting: 'Extracting', done: 'Done', no_answer: 'No answer' }

export function transcriptLine(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const speaker = item.speaker ?? item.role
    const text = item.text ?? item.message
    if (text === undefined) return null
    return speaker ? `${speaker}: ${text}` : String(text)
  }
  return null
}

export function extractedChips(extracted) {
  if (!extracted || typeof extracted !== 'object') return []
  const chips = []
  const known = ['has_heat', 'needs_help', 'medical_issue', 'can_leave']
  if ('has_heat' in extracted) chips.push({ key: 'has_heat', text: extracted.has_heat ? 'Has heat' : 'No heat', bad: !extracted.has_heat })
  if ('needs_help' in extracted && extracted.needs_help) chips.push({ key: 'needs_help', text: 'Needs help', bad: true })
  if (extracted.medical_issue) chips.push({ key: 'medical_issue', text: String(extracted.medical_issue), bad: true })
  if ('can_leave' in extracted) chips.push({ key: 'can_leave', text: extracted.can_leave ? 'Can leave' : "Can't leave", bad: !extracted.can_leave })
  for (const [k, v] of Object.entries(extracted)) {
    if (!known.includes(k)) chips.push({ key: k, text: `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`, bad: false })
  }
  return chips
}

function Stepper({ phase }) {
  if (phase === 'no_answer') return <p className="phase-end">No answer</p>
  const idx = PHASES.indexOf(phase)
  return (
    <ol className="stepper" aria-label="Call phase">
      {PHASES.filter((p) => p !== 'no_answer').map((p, i) => (
        <li key={p} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
          {PHASE_LABEL[p]}
        </li>
      ))}
    </ol>
  )
}

// Every ringing house gets its own card; the presenter answers one at a time.
export function IncomingCalls({ calls = [], voice, homesById = {} }) {
  if (!voice) return null
  const ringing = calls.filter((c) => c.source === 'live' && c.phase === 'ringing' && c.home_id !== voice.activeHome)
  const onCall = voice.activeHome && (voice.status === 'talking' || voice.status === 'connecting')
  if (!onCall && ringing.length === 0 && voice.status !== 'error') return null
  return (
    <div className="incoming-stack">
      {onCall && (
        <div className="incoming talking">
          <div className="incoming-text"><span className="ring-dot on" />
            {voice.status === 'connecting' ? `Connecting the AI agent to ${voice.activeHome}…` : `On the call with ${voice.activeHome}: speak as the resident`}
          </div>
          <button type="button" className="btn-decline" onClick={voice.hangUp}><PhoneOff size={16} /> Hang up</button>
        </div>
      )}
      {voice.status === 'error' && <p className="error">Voice error: {voice.error}</p>}
      {ringing.length > 0 && (
        <div className="ring-grid">
          {ringing.map((c) => {
            const h = homesById[c.home_id]
            return (
              <div key={c.home_id} className="incoming ring-card" role="group" aria-label={`Incoming check-in call for ${c.home_id}`}>
                <div className="ring-info">
                  <span className="ring-dot" />
                  <span>
                    <strong>{c.home_id}</strong>{h ? <span className="muted"> · Block {h.block} · {h.temp_f != null ? `${h.temp_f.toFixed(1)}°F` : ''}</span> : null}
                    <span className="ring-left">{c.ring_left_s != null ? `Ringing · drops in ${c.ring_left_s} s` : 'Ringing'}</span>
                  </span>
                </div>
                <div className="incoming-actions">
                  <button type="button" className="btn-answer" disabled={voice.busy} title={voice.busy ? 'Finish the current call first' : undefined}
                    onClick={() => voice.answer(c)}><Phone size={16} /> {voice.busy ? 'Busy' : 'Answer'}</button>
                  <button type="button" className="btn-decline" onClick={() => voice.decline(c.home_id)}><PhoneOff size={16} /> Decline</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CallPanel({ call, events = [], highlight, voice }) {
  if (!call) {
    const past = events.find((e) => e && e.type === 'call_result')
    return (
      <div className={`call${highlight ? ' highlight' : ''}`}>
        <p className="muted">No call for this house</p>
        {past && <p className="muted">Last call (past): {simClock(past.t)} · {past.text}</p>}
      </div>
    )
  }
  // While the browser call is open (and until the webhook delivers the real transcript) follow it live.
  const followLive = voice && voice.activeHome === call.home_id && call.source === 'live' && ['ringing', 'in_call'].includes(call.phase)
    && (voice.status === 'talking' || voice.status === 'connecting' || voice.ended)
  const shownPhase = followLive
    ? (voice.ended ? 'extracting' : voice.status === 'talking' ? 'in_call' : 'ringing')
    : call.phase
  const source = followLive && voice.liveLines.length ? voice.liveLines : call.transcript || []
  const lines = source.map(transcriptLine).filter((l) => l !== null)
  const chips = extractedChips(call.extracted)
  return (
    <div className={`call${highlight ? ' highlight' : ''}`}>
      <div className="call-head">
        <strong>{call.home_id}</strong>
        <span className={`pill ${call.source === 'live' ? 'live-test' : 'scripted'}`}>
          {call.source === 'live' ? 'LIVE' : 'SCRIPTED'}
        </span>
        <span className="muted">Language: {call.language || 'Unavailable'}</span>
      </div>
      <Stepper phase={shownPhase} />
      {lines.length === 0 ? (
        <p className="muted">Waiting for transcript…</p>
      ) : (
        <ul className="transcript">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      )}
      {chips.length > 0 && (
        <ul className="chips" aria-label="Extracted fields">
          {chips.map((c) => <li key={c.key} className={`chip${c.bad ? ' bad' : ''}`}>{c.text}</li>)}
        </ul>
      )}
      {call.extracted && (
        <details>
          <summary>Raw extracted JSON</summary>
          <pre className="mono">{JSON.stringify(call.extracted, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}
