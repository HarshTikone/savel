import { useEffect, useRef, useState } from 'react'
import { POLL_MS } from '../config'
import { getSeries } from '../services/api'

// Returns { series, error, loading } for the selected home. runId clears the cache on a new run.
export function useSeries(selectedId, runId) {
  const [series, setSeries] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    setSeries(null)
    setError(null)
  }, [selectedId, runId])

  useEffect(() => {
    if (!selectedId) {
      setLoading(false)
      return undefined
    }
    let alive = true
    setLoading(true)

    const load = async () => {
      if (inFlight.current) return
      inFlight.current = true
      try {
        const s = await getSeries(selectedId)
        if (!alive) return
        setSeries(s)
        setError(null)
      } catch (e) {
        if (!alive) return
        if (e && e.status === 404) {
          setSeries(null)
          setError('Unknown home')
        } else {
          setError(e && e.detail ? e.detail : 'Unable to load series')
        }
      } finally {
        inFlight.current = false
        if (alive) setLoading(false)
      }
    }

    load()
    const t = setInterval(load, POLL_MS)
    return () => {
      alive = false
      inFlight.current = false
      clearInterval(t)
    }
  }, [selectedId, runId])

  return { series, error, loading }
}
