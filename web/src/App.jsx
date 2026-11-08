import { useCallback, useEffect, useState } from 'react'
import { useDashboardData } from './hooks/useDashboardData'
import { useVoiceCall } from './hooks/useVoiceCall'
import { useTrends } from './hooks/useTrends'
import { useSim } from './hooks/useSim'
import TopBar from './components/TopBar'
import ResponderPage from './pages/ResponderPage'
import SimulationPage from './pages/SimulationPage'
import AgentPage from './pages/AgentPage'
import { helpHome } from './services/api'
import { IncomingCalls } from './components/CallPanel'
import { useRingtone } from './hooks/useRingtone'

function usePage() {
  const read = () => {
    const h = window.location.hash
    if (h.startsWith('#/sim')) return 'sim'
    if (h.startsWith('#/agent')) return 'agent'
    return 'responder'
  }
  const [page, setPage] = useState(read)
  useEffect(() => {
    const on = () => setPage(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return page
}

export default function App() {
  const page = usePage()
  const data = useDashboardData()
  const homesById = Object.fromEntries(data.homes.map((h) => [h.id, h]))
  const voice = useVoiceCall(homesById)
  const calls = data.calls || []
  const trends = useTrends(data.runId)
  const sim = useSim(data.refresh)
  const [helpPending, setHelpPending] = useState({})
  const anyRinging = calls.some((c) => c.source === 'live' && c.phase === 'ringing' && !(voice.busy && c.home_id === voice.activeHome))
  // The house we last talked to is ringing again: drop the old call's 'ended' state and transcript.
  const reRing = !voice.busy && voice.activeHome && calls.some((c) => c.home_id === voice.activeHome && c.phase === 'ringing')
  useEffect(() => { if (reRing && voice.ended) voice.forgetEnded() }, [reRing]) // eslint-disable-line react-hooks/exhaustive-deps
  useRingtone(anyRinging)

  const onHelp = useCallback(async (id) => {
    setHelpPending((p) => ({ ...p, [id]: true }))
    try {
      await helpHome(id)
      if (data.refresh) await data.refresh()
    } finally {
      setHelpPending((p) => ({ ...p, [id]: false }))
    }
  }, [data.refresh])

  return (
    <div className="app">
      <TopBar page={page} state={data.state} connection={data.connection} />
      {/* Incoming calls float above every page, so a ringing house is never missed. */}
      <div className="call-dock" aria-live="polite">
        <IncomingCalls calls={calls} voice={voice} homesById={homesById} />
      </div>
      {page === 'sim' ? (
        <SimulationPage data={data} sim={sim} calls={calls} onHelp={onHelp} helpPending={helpPending} />
      ) : page === 'agent' ? (
        <AgentPage data={data} voice={voice} calls={calls} homesById={homesById} />
      ) : (
        <ResponderPage data={data} voice={voice} calls={calls} homesById={homesById} trends={trends} onHelp={onHelp} helpPending={helpPending} />
      )}
    </div>
  )
}
