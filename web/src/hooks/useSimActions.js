import { useCallback, useState } from 'react'
import { simAction, simReset } from '../services/api'
import { VENT_HOME } from '../config'

// Wraps every simulator call with pending and error state. Pressed/active states always come
// from backend state; ventBlocked is only set after a successful POST (the backend exposes no vent state).
export function useSimActions({ state, ventBlocked, setVentBlocked, refresh }) {
  const [pending, setPending] = useState({})
  const [error, setError] = useState(null)

  const run = useCallback(async (key, fn, onSuccess) => {
    let skip = false
    setPending((p) => {
      if (p[key]) skip = true
      return p[key] ? p : { ...p, [key]: true }
    })
    if (skip) return
    try {
      await fn()
      if (onSuccess) onSuccess()
      setError(null)
      if (refresh) await refresh()
    } catch (e) {
      setError({ key, detail: (e && e.detail) || 'Request failed' })
    } finally {
      setPending((p) => ({ ...p, [key]: false }))
    }
  }, [refresh])

  const powerOn = (b) => {
    const entry = state && state.blocks ? state.blocks.find((x) => x.block === b) : null
    return entry ? entry.power_on : true
  }

  return {
    pending,
    error,
    powerOn,
    toggleBlock: (b) => run(`block-${b}`, () => simAction(powerOn(b) ? 'cut_power' : 'restore_power', b)),
    toggleVent: () =>
      run('vent', () => simAction(ventBlocked ? 'clear_vent' : 'block_vent', VENT_HOME), () => setVentBlocked(!ventBlocked)),
    setOutdoor: (v) => run('outdoor', () => simAction('outdoor', v)),
    setSpeed: (v) => run('speed', () => simAction('speed', v)),
    reset: (prewarm) =>
      run(
        prewarm === 0 ? 'reset-clean' : 'reset-warm',
        () => (prewarm === 0 ? simReset({ prewarm: 0 }) : simReset()),
        () => setVentBlocked(false),
      ),
  }
}
