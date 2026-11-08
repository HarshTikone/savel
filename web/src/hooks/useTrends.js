import { useEffect, useState } from 'react'
import { POLL_MS } from '../config'
import { getTrends } from '../services/api'

export function useTrends(runId) {
  const [trends, setTrends] = useState({ window: 15, blocks: [], homes: {} })
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const t = await getTrends()
        if (alive) setTrends(t)
      } catch { /* keep the last trend */ }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [runId])
  return trends
}
