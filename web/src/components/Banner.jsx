import { useEffect, useRef, useState } from 'react'

const key = (e) => `${e.t}|${e.type}|${e.home_id}`
const notable = (e) => e && (e.severity === 'critical' || e.type === 'call_result')

// One-line banner for new critical events and call results. Existing events at first load
// (and after a run change) are treated as already seen so nothing floods on page open.
export default function Banner({ events, ready, runId }) {
  const seen = useRef(new Set())
  const primed = useRef(false)
  const lastRun = useRef(runId)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (lastRun.current !== runId) {
      lastRun.current = runId
      seen.current = new Set()
      setMessage(null)
    }
  }, [runId])

  useEffect(() => {
    if (!ready) return undefined
    const list = (events || []).filter((e) => e && e.t)
    if (!primed.current) {
      list.forEach((e) => seen.current.add(key(e)))
      primed.current = true
      return undefined
    }
    const fresh = list.filter((e) => !seen.current.has(key(e)))
    fresh.forEach((e) => seen.current.add(key(e)))
    const show = fresh.find(notable)
    if (!show) return undefined
    setMessage({ text: show.text, severity: show.severity })
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [events, ready])

  return (
    <div className="banner-region" aria-live="polite">
      {message && <div className={`banner ${message.severity}`}>{message.text}</div>}
    </div>
  )
}
