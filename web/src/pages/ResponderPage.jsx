import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Phone, HeartPulse, ZapOff } from 'lucide-react'
import HomeMap from '../components/HomeMap'
import BlockGridMap from '../components/BlockGridMap'
import PriorityList from '../components/PriorityList'
import HouseCard from '../components/HouseCard'
import HouseStory from '../components/HouseStory'
import CallPanel from '../components/CallPanel'
import TemperatureChart from '../components/TemperatureChart'
import ActivityFeed from '../components/ActivityFeed'
import GlobeIntro from '../components/GlobeIntro'
import TrendStrip from '../components/TrendStrip'
import CallsBoard from '../components/CallsBoard'
import { useSeries } from '../hooks/useSeries'
import { useStory } from '../hooks/useStory'
import { rankOf, rankedHomes, withCall, callSettled } from '../lib/story'
import { STATUS_COLOR } from '../lib/colors'
import { STATUS_META } from '../data/contract'

function Tiles({ homes, state }) {
  const atRisk = homes.filter((h) => ['warning', 'critical'].includes(h.status)).length
  const critical = homes.filter((h) => h.status === 'critical').length
  const help = homes.filter((h) => ['needs_help', 'medical'].includes(h.outcome)).length
  const noPower = homes.filter((h) => h.power_on === false).length
  const items = [
    { label: 'At risk', value: atRisk, icon: AlertTriangle, tone: atRisk ? 'warn' : '' },
    { label: 'Critical', value: critical, icon: AlertTriangle, tone: critical ? 'bad' : '' },
    { label: 'Need help (from calls)', value: help, icon: HeartPulse, tone: help ? 'bad' : '' },
    { label: 'Calls made', value: homes.filter((h) => h.call_status !== 'none').length, icon: Phone },
    { label: 'Homes without power', value: noPower, icon: ZapOff, tone: noPower ? 'warn' : '' },
  ]
  return (
    <ul className="tiles">
      {items.map((t) => (
        <li key={t.label} className={`tile ${t.tone}`}>
          <t.icon size={16} />
          <span className="tile-value">{t.value}</span>
          <span className="tile-label">{t.label}</span>
        </li>
      ))}
      {state && state.focus_home == null && homes.length > 0 && atRisk === 0 && (
        <li className="tile hint">Start on the Simulation page: pick a house and cut its power.</li>
      )}
    </ul>
  )
}

function Legend() {
  return (
    <ul className="legend">
      {['heated', 'cooling', 'warning', 'critical', 'recovering', 'leaving'].map((s) => (
        <li key={s}><span className="swatch" style={{ background: STATUS_COLOR[s] }} />{STATUS_META[s].label}</li>
      ))}
    </ul>
  )
}

export default function ResponderPage({ data, voice, calls = [], homesById = {}, trends, onHelp, helpPending }) {
  const { homes, state, events, call, runId } = data
  const [picked, setPicked] = useState(null)
  const [mapMode, setMapMode] = useState('map')
  const [intro, setIntro] = useState(true)       // Earth intro each time the Responder page opens
  const [introRun, setIntroRun] = useState(false)
  const [pulseId, setPulseId] = useState(null)
  const lastCall = useRef(null)

  useEffect(() => { setPicked(null) }, [runId])

  // A new call takes focus so the audience sees it.
  const callHome = call ? call.home_id : null
  useEffect(() => {
    if (!callHome || lastCall.current === callHome) return undefined
    lastCall.current = callHome
    setPicked((p) => p || callHome)
    setPulseId(callHome)
    const t = setTimeout(() => setPulseId(null), 3000)
    return () => clearTimeout(t)
  }, [callHome])

  const focusId = state ? state.focus_home : null
  const selectedId = picked || focusId || (rankedHomes(homes)[0] || {}).id || null
  const home = homes.find((h) => h.id === selectedId)
  const rank = home ? rankOf(homes, home.id) : null
  // The timeline follows the house on screen.
  const storyHome = withCall(home, home ? calls.find((c) => c.home_id === home.id) : null)
  const steps = useStory(storyHome, rank, events, runId)
  const series = useSeries(selectedId, runId)
  // Once the house is helped and back to normal (same moment the timeline resets), its call clears too.
  const settled = home ? callSettled(home, runId) : false
  const callForHome = home && !settled ? calls.find((c) => c.home_id === home.id) || null : null

  return (
    <div className="page responder">
      {home && (
        <section className="card story-card" aria-label="House story">
          <div className="story-title">Timeline · <span className="strong-id">{home.id}</span>
            {steps.every((s) => s.state === 'todo') && <span className="muted"> · no incident right now</span>}
          </div>
          <HouseStory steps={steps} home={storyHome} rank={rank} />
        </section>
      )}
      <Tiles homes={homes} state={state} />
      <CallsBoard calls={calls} homes={homes} runId={runId} selectedId={selectedId} onSelect={setPicked} />
      <TrendStrip trends={trends} selectedId={selectedId} />
      <div className="r-grid">
        <section className="card" aria-label="Priority list">
          <h2>Priority list</h2>
          <PriorityList homes={homes} selectedId={selectedId} onSelect={setPicked} onHelp={onHelp} pending={helpPending} />
        </section>
        <section className="card map-card" aria-label="Map">
          <div className="card-head">
            <h2>Neighborhood</h2>
            <div className="seg">
              <button type="button" className={mapMode === 'map' ? 'on' : ''} onClick={() => setMapMode('map')}>Map</button>
              <button type="button" className={mapMode === 'grid' ? 'on' : ''} onClick={() => setMapMode('grid')}>Grid</button>
            </div>
          </div>
          <div className={`map-body${intro ? ' intro' : ''}${introRun ? ' run' : ''}`}>
            {intro && <GlobeIntro onStart={() => setIntroRun(true)} onDone={() => { setIntro(false); setIntroRun(false) }} />}
            {mapMode === 'map' ? (
              <HomeMap homes={homes} blocks={state ? state.blocks : []} selectedId={selectedId} onSelect={setPicked} runKey={runId} pulseId={pulseId} onTileFail={() => setMapMode('grid')} />
            ) : (
              <BlockGridMap homes={homes} blocks={state ? state.blocks : []} selectedId={selectedId} onSelect={setPicked} pulseId={pulseId} />
            )}
          </div>
          <Legend />
          <h2 className="sub">Activity</h2>
          <ActivityFeed events={events} onSelect={setPicked} />
        </section>
        <section className="card" aria-label="House details">
          <HouseCard home={home} rank={rank} onHelp={onHelp} helpPending={home ? !!helpPending[home.id] : false} incidentOver={steps.cleared}>
            <div className="house-section">
              <h3>AI check-in call</h3>
              <CallPanel call={callForHome} events={settled ? [] : (events || []).filter((e) => !home || e.home_id === home.id)} voice={voice} />
            </div>
            <div className="house-section">
              <h3>Temperature</h3>
              <TemperatureChart series={series.series} error={series.error} loading={series.loading} selectedId={selectedId} height={200} />
            </div>
          </HouseCard>
        </section>
      </div>
    </div>
  )
}
