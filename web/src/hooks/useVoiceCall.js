import { useCallback, useRef, useState } from 'react'
import { ELEVEN_AGENT_ID, ELEVEN_CLIENT_URL } from '../config'

const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})

// The presenter plays the resident. Several houses can ring at once; the presenter answers one.
// Answer is a real click, so the browser allows the microphone and the agent's voice.
// status: idle | connecting | talking | error   (for activeHome)
export function useVoiceCall(homesById = {}) {
  const [activeHome, setActiveHome] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [liveLines, setLiveLines] = useState([])
  const [ended, setEnded] = useState(false)
  const session = useRef(null)
  const linesRef = useRef([])

  const answer = useCallback(async (entry) => {
    if (!entry || session.current) return
    const home = homesById[entry.home_id]
    setActiveHome(entry.home_id)
    setStatus('connecting')
    setLiveLines([])
    linesRef.current = []
    setEnded(false)
    setError('')
    try {
      const mod = await import(/* @vite-ignore */ ELEVEN_CLIENT_URL)
      const Conversation = mod.Conversation || (mod.default && mod.default.Conversation)
      session.current = await Conversation.startSession({
        agentId: ELEVEN_AGENT_ID,
        connectionType: 'webrtc',
        dynamicVariables: {
          home_id: entry.home_id,
          resident_label: home && home.block ? `a resident on Block ${home.block}` : 'a resident',
          reason: 'warning',
          language: entry.language === 'es' ? 'Spanish' : 'English',
        },
        onConnect: () => {
          setStatus('talking')
          post('/api/calls/live/answered', { home_id: entry.home_id })
        },
        onMessage: (m) => {
          const text = m && (m.message || m.text)
          if (!text) return
          const who = m.source === 'ai' || m.role === 'agent' ? 'SAVEL' : 'Resident'
          linesRef.current = [...linesRef.current, `${who}: ${text}`]
          setLiveLines(linesRef.current)
        },
        onDisconnect: () => {
          // Hand the backend what was said, so the result never waits on the ElevenLabs webhook.
          post('/api/calls/live/ended', { home_id: entry.home_id, transcript: linesRef.current })
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
  }, [homesById])

  const decline = useCallback((homeId) => post('/api/calls/live/declined', { home_id: homeId }), [])

  const hangUp = useCallback(async () => {
    if (session.current) {
      try { await session.current.endSession() } catch { /* already closed */ }
    }
  }, [])

  const busy = status === 'connecting' || status === 'talking'
  // A new ring for the house we last talked to starts fresh (old transcript and 'ended' do not carry over).
  const forgetEnded = useCallback(() => { setEnded(false); setLiveLines([]); linesRef.current = [] }, [])
  return { activeHome, status, error, liveLines, ended, busy, answer, decline, hangUp, forgetEnded }
}
