import { useEffect, useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react'
import { getBriefing } from '../services/api'

// One-click handoff for a responder: Gemini writes it from the house's facts (template if Gemini is down).
export default function Briefing({ home }) {
  const [state, setState] = useState({ status: 'idle', text: '', source: '', at: null })
  const [copied, setCopied] = useState(false)
  const id = home ? home.id : null

  useEffect(() => { setState({ status: 'idle', text: '', source: '', at: null }); setCopied(false) }, [id])

  if (!home) return null
  const load = async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    try {
      const b = await getBriefing(home.id)
      setState({ status: 'ready', text: b.text, source: b.source, at: home.temp_f })
    } catch (e) {
      setState({ status: 'error', text: (e && e.detail) || 'Could not write a briefing', source: '', at: null })
    }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(state.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* no clipboard */ }
  }

  if (state.status === 'idle' || (state.status === 'loading' && !state.text)) {
    return (
      <button type="button" className="btn-brief" onClick={load} disabled={state.status === 'loading'}>
        <Sparkles size={16} /> {state.status === 'loading' ? 'Writing briefing…' : 'Responder briefing'}
      </button>
    )
  }
  return (
    <div className={`briefing${state.status === 'error' ? ' err' : ''}`} aria-live="polite">
      <div className="briefing-head">
        <span className="briefing-title"><Sparkles size={14} /> Responder briefing</span>
        {state.source && <span className="badge">{state.source === 'gemini' ? 'Gemini' : 'Rule-based'}</span>}
      </div>
      <p className="briefing-text">{state.text}</p>
      <div className="briefing-actions">
        {state.status !== 'error' && (
          <button type="button" className="btn" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
        )}
        <button type="button" className="btn" onClick={load} disabled={state.status === 'loading'}>
          <RefreshCw size={14} className={state.status === 'loading' ? 'spin' : ''} /> {state.status === 'loading' ? 'Updating…' : 'Update'}
        </button>
      </div>
    </div>
  )
}
