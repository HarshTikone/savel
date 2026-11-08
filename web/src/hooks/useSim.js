import { useCallback, useState } from 'react'
import { simAction, simReset } from '../services/api'

export function useSim(refresh) {
  const [pending, setPending] = useState({})
  const [error, setError] = useState(null)
  const run = useCallback(async (key, fn) => {
    setPending((p) => ({ ...p, [key]: true }))
    try {
      await fn()
      setError(null)
      if (refresh) await refresh()
    } catch (e) {
      setError({ key, detail: (e && e.detail) || 'Request failed' })
    } finally {
      setPending((p) => ({ ...p, [key]: false }))
    }
  }, [refresh])
  return {
    pending,
    error,
    house: (action, id) => run('house', () => simAction(action, id)),
    vent: (on, id) => run('vent', () => simAction(on ? 'block_vent' : 'clear_vent', id)),
    block: (b, cut) => run(`block-${b}`, () => simAction(cut ? 'cut_power' : 'restore_power', b)),
    speed: (v) => run('speed', () => simAction('speed', v)),
    reset: (prewarm) => run('reset', () => (prewarm === 0 ? simReset({ prewarm: 0 }) : simReset())),
  }
}
