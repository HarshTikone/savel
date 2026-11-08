import { useCallback, useEffect, useRef, useState } from 'react'
import { ELEVEN_AGENT_ID, ELEVEN_CLIENT_URL } from '../config'

const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})

// The presenter plays the resident: a ringing live call waits for Answer or Decline.
// Answer is a real click, so the browser allows the microphone and the agent's voice.
// states: idle | connecting | talking | error
export function useVoiceCall(call, home) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [liveLines, setLiveLines] = useState([])
  const [ended, setEnded] = useState(false)
  const session = useRef(null)
  const homeId = call ? call.home_id : null

  // A new call (or a new house) starts with a clean slate.
  useEffect(() => {
    if (call && call.source === 'live' && call.phase === 'ringing' && !session.current) {
      setEnded(false)
      setLiveLines([])
      setError('')
    }
  }, [homeId, call && call.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = useCallback(async () => {
    if (!call || session.current) return
    const target = call
    setStatus('connecting')
    setLiveLines([])
    setEnded(false)
    setError('')
    try {
      const mod = await import(/* @vite-ignore */ ELEVEN_CLIENT_URL)
      const Conversation = mod.Conversation || (mod.default && mod.default.Conversation)
      session.current = await Conversation.startSession({
        agentId: ELEVEN_AGENT_ID,
        connectionType: 'webrtc',
        dynamicVariables: {
          home_id: target.home_id,
          resident_label: home && home.block ? `a resident on Block ${home.block}` : 'a resident',
          reason: 'warning',
          language: target.language === 'es' ? 'Spanish' : 'English',
        },
        onConnect: () => {
          setStatus('talking')
          post('/api/calls/live/answered', { home_id: target.home_id })
        },
        onMessage: (m) => {
          const text = m && (m.message || m.text)
          if (!text) return
          const who = m.source === 'ai' || m.role === 'agent' ? 'SAVEL' : 'Resident'
          setLiveLines((prev) => [...prev, `${who}: ${text}`])
        },
        onDisconnect: () => {
          session.current = null
          setEnded(true)
          setStatus('idle')
        },
        onError: (e) => {
          setError(String((e && e.message) || e))
          setStatus('error')
        },
      })
    } catch (e) {
      session.current = null
      setError(String((e && e.message) || e))
      setStatus('error')
    }
  }, [call, home])

  const decline = useCallback(() => {
    if (call) post('/api/calls/live/declined', { home_id: call.home_id })
  }, [call])

  const hangUp = useCallback(async () => {
    if (session.current) {
      try { await session.current.endSession() } catch { /* already closed */ }
    }
  }, [])

  return { status, error, liveLines, ended, answer, decline, hangUp }
}
