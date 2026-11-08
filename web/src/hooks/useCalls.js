import { useEffect, useState } from 'react'
import { POLL_MS } from '../config'
import { getCalls } from '../services/api'

export function useCalls(runId) {
  const [calls, setCalls] = useState([])
  useEffect(() => {
    let alive = true
    setCalls([])
    const load = async () => {
      try {
        const c = await getCalls()
        if (alive && Array.isArray(c)) setCalls(c)
      } catch { /* keep the last list */ }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [runId])
  return calls
}
