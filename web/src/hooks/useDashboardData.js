import { useCallback, useEffect, useRef, useState } from 'react'
import { POLL_MS, HEALTH_MS, STALE_AFTER_FAILS, DATA_MODE } from '../config'
import { getState, getHomes, getEvents, getCurrentCall, getAccuracy, getHealth, getCalls } from '../services/api'

const EMPTY = { state: null, homes: [], events: [], call: null, accuracy: [], calls: [] }

export function useDashboardData({ onRunChange } = {}) {
  const [data, setData] = useState(EMPTY)
  const [fails, setFails] = useState(0)
  const [hasData, setHasData] = useState(false)
  const [healthDown, setHealthDown] = useState(false)
  const [health, setHealth] = useState(null)

  const inFlight = useRef(false)
  const prevRun = useRef(null)
  const failCount = useRef(0)
  const runChangeRef = useRef(onRunChange)
  runChangeRef.current = onRunChange
  const alive = useRef(true)

  const poll = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const results = await Promise.allSettled([
        getState(), getHomes(), getEvents(), getCurrentCall(), getAccuracy(), getCalls(),
      ])
      if (!alive.current) return
      const [st, hm, ev, cl, ac, cs] = results
      if (results.every((r) => r.status === 'rejected')) {
        failCount.current += 1
        setFails(failCount.current)
        return
      }
      failCount.current = 0
      setFails(0)
      setHasData(true)

      const runId = st.status === 'fulfilled' ? st.value.run_id : null
      const changed = runId !== null && prevRun.current !== null && runId !== prevRun.current
      if (runId !== null) prevRun.current = runId

      setData((prev) => {
        const base = changed ? { ...prev, events: [], call: null, accuracy: [], calls: [] } : prev
        return {
          state: st.status === 'fulfilled' ? st.value : base.state,
          homes: hm.status === 'fulfilled' ? hm.value : base.homes,
          events: ev.status === 'fulfilled' ? ev.value : base.events,
          call: cl.status === 'fulfilled' ? cl.value : base.call,
          accuracy: ac.status === 'fulfilled' ? ac.value : base.accuracy,
          // Fetched in the same poll as homes, so the screen never shows a call the house list hasn't caught up with.
          calls: cs && cs.status === 'fulfilled' && Array.isArray(cs.value) ? cs.value : base.calls,
        }
      })
      if (changed && runChangeRef.current) runChangeRef.current(runId)
    } finally {
      inFlight.current = false
    }
  }, [])

  const pollHealth = useCallback(async () => {
    try {
      const h = await getHealth()
      if (!alive.current) return
      setHealth(h)
      setHealthDown(false)
    } catch {
      if (alive.current) setHealthDown(true)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    poll()
    pollHealth()
    const t1 = setInterval(poll, POLL_MS)
    const t2 = setInterval(pollHealth, HEALTH_MS)
    return () => {
      alive.current = false
      clearInterval(t1)
      clearInterval(t2)
    }
  }, [poll, pollHealth])

  let connection
  if (DATA_MODE === 'mock') connection = 'mock'
  else if (!hasData && fails === 0) connection = 'connecting'
  else if (healthDown) connection = 'unavailable'
  else if (fails >= STALE_AFTER_FAILS) connection = 'stale'
  else connection = 'live'

  return {
    ...data,
    health,
    connection,
    lastUpdated: data.state ? data.state.sim_now : null,
    runId: data.state ? data.state.run_id : null,
    refresh: poll,
  }
}
