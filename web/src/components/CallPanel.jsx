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

export function IncomingCall({ call, voice }) {
  if (!voice || !call || call.source !== 'live') return null
  if (call.phase === 'ringing' && voice.status !== 'talking' && voice.status !== 'connecting' && !voice.ended) {
    return (
      <div className="incoming" role="group" aria-label={`Incoming check-in call for ${call.home_id}`}>
        <div className="incoming-text"><span className="ring-dot" /> SAVEL is calling the resident at {call.home_id}</div>
        <div className="incoming-actions">
          <button type="button" className="btn-answer" onClick={voice.answer}><Phone size={18} /> Answer</button>
          <button type="button" className="btn-decline" onClick={voice.decline}><PhoneOff size={18} /> Decline</button>
        </div>
        {voice.error && <p className="error">{voice.error}</p>}
      </div>
    )
  }
  if (voice.status === 'connecting') return <p className="muted">Connecting the AI agent…</p>
  if (voice.status === 'talking') {
    return (
      <div className="incoming talking">
        <div className="incoming-text"><span className="ring-dot on" /> On the call: speak as the resident</div>
        <button type="button" className="btn-decline" onClick={voice.hangUp}><PhoneOff size={16} /> Hang up</button>
      </div>
    )
  }
  if (voice.status === 'error') return <p className="error">Voice error: {voice.error}</p>
  return null
}

export default function CallPanel({ call, events = [], highlight, voice }) {
  if (!call) {
    const past = events.find((e) => e && e.type === 'call_result')
    return (
      <div className={`call${highlight ? ' highlight' : ''}`}>
        <p className="muted">No call in progress</p>
        {past && <p className="muted">Last call (past): {simClock(past.t)} · {past.text}</p>}
      </div>
    )
  }
  // While the browser call is open (and until the webhook delivers the real transcript) follow it live.
  const followLive = voice && call.source === 'live' && ['ringing', 'in_call'].includes(call.phase)
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
          {call.source === 'live' ? 'LIVE TEST' : 'SCRIPTED'}
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
