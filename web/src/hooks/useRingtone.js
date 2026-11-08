import { useEffect, useRef } from 'react'

// A soft two-tone ring while any call is ringing, so a call is noticed on every page.
// Browsers only allow sound after the user has clicked the page once; until then it stays silent.
export function useRingtone(ringing) {
  const ctx = useRef(null)
  useEffect(() => {
    if (!ringing) return undefined
    const ring = () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return
        if (!ctx.current) ctx.current = new AC()
        const ac = ctx.current
        if (ac.state === 'suspended') ac.resume().catch(() => {})
        ;[0, 0.25].forEach((offset, i) => {
          const o = ac.createOscillator()
          const g = ac.createGain()
          o.frequency.value = i ? 660 : 880
          g.gain.setValueAtTime(0.0001, ac.currentTime + offset)
          g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + offset + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + offset + 0.22)
          o.connect(g).connect(ac.destination)
          o.start(ac.currentTime + offset)
          o.stop(ac.currentTime + offset + 0.24)
        })
      } catch { /* no audio available */ }
    }
    ring()
    const id = setInterval(ring, 2500)
    return () => clearInterval(id)
  }, [ringing])
}
