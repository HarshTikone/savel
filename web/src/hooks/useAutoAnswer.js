import { useCallback, useEffect, useRef, useState } from 'react'
import { ELEVEN_AGENT_ID, ELEVEN_CLIENT_URL } from '../config'

// Connects the ElevenLabs voice agent when the backend reports a live call that is ringing.
// On by default (remembered per browser). Only the Responder page answers, so a second window can't double-call.
// states: off | ready | connecting | talking | error
const readPref = () => {
  try { return window.localStorage.getItem('savel.aiCalls') !== 'off' } catch { return true }
}
const savePref = (on) => {
  try { window.localStorage.setItem('savel.aiCalls', on ? 'on' : 'off') } catch { /* private mode */ }
}

export function useAutoAnswer(call, home, active = true) {
  const [enabled, setEnabled] = useState(readPref)
  const [status, setStatus] = useState(() => (readPref() ? 'ready' : 'off'))
  const [error, setError] = useState('')
  const [liveLines, setLiveLines] = useState([])
  const [ended, setEnded] = useState(false)
  const session = useRef(null)
  const lastKey = useRef(null)

  const enable = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())      // permission granted; the SDK opens its own stream
      setEnabled(true)
      savePref(true)
      setStatus('ready')
      setError('')
    } catch {
      setError('Microphone permission denied')
      setStatus('error')
    }
  }, [])

  const disable = useCallback(async () => {
    setEnabled(false)
    savePref(false)
    setStatus('off')
    if (session.current) {
      try { await session.current.endSession() } catch { /* already closed */ }
      session.current = null
    }
  }, [])

  // Ask for the microphone on the first click anywhere, so a ringing call never waits on a prompt
  // and the browser counts the page as user-activated (needed to play the agent's voice).
  useEffect(() => {
    if (!enabled || !active || !navigator.mediaDevices) return undefined
    const warm = () => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((st) => st.getTracks().forEach((t) => t.stop()))
        .catch(() => setError('Microphone permission denied'))
    }
    window.addEventListener('pointerdown', warm, { once: true })
    return () => window.removeEventListener('pointerdown', warm)
  }, [enabled, active])

  const ringing = call && call.source === 'live' && call.phase === 'ringing' ? call : null
  const ringKey = ringing ? `${ringing.home_id}` : null

  useEffect(() => {
    if (!enabled || !active || !ringKey || lastKey.current === ringKey || session.current) return
    lastKey.current = ringKey
    let cancelled = false
    ;(async () => {
      setStatus('connecting')
      setLiveLines([])
      setEnded(false)
      try {
        const mod = await import(/* @vite-ignore */ ELEVEN_CLIENT_URL)
        const Conversation = mod.Conversation || (mod.default && mod.default.Conversation)
        const label = home && home.block ? `a resident on Block ${home.block}` : 'a resident'
        const conv = await Conversation.startSession({
          agentId: ELEVEN_AGENT_ID,
          connectionType: 'webrtc',
          dynamicVariables: {
            home_id: ringing.home_id,
            resident_label: label,
            reason: 'warning',
            language: ringing.language === 'es' ? 'Spanish' : 'English',
          },
          onConnect: () => {
            setStatus('talking')
            fetch('/api/calls/live/answered', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ home_id: ringing.home_id }),
            }).catch(() => {})
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
            setStatus('ready')
          },
          onError: (e) => {
            setError(String((e && e.message) || e))
            setStatus('error')
          },
        })
        if (cancelled) { try { await conv.endSession() } catch { /* ignore */ } return }
        session.current = conv
      } catch (e) {
        setError(String((e && e.message) || e))
        setStatus('error')
        lastKey.current = null
      }
    })()
    return () => { cancelled = true }
  }, [enabled, active, ringKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!ringKey && status !== 'talking') lastKey.current = null }, [ringKey, status])

  return { enabled, status, error, enable, disable, liveLines, ended }
}
