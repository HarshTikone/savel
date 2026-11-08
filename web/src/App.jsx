import { useCallback, useEffect, useRef, useState } from 'react'
import { useDashboardData } from './hooks/useDashboardData'
import { useSeries } from './hooks/useSeries'
import Header from './components/Header'
import KpiStrip from './components/KpiStrip'
import Headline from './components/Headline'
import MapPanel from './components/MapPanel'
import PriorityQueue from './components/PriorityQueue'
import HomeDetails from './components/HomeDetails'
import TemperatureChart from './components/TemperatureChart'
import CallPanel from './components/CallPanel'
import EventLog from './components/EventLog'
import Banner from './components/Banner'
import SimulatorControls from './components/SimulatorControls'
import AccuracyPanel from './components/AccuracyPanel'
import ShortcutHelp from './components/ShortcutHelp'
import { useSimActions } from './hooks/useSimActions'
import { useShortcuts } from './hooks/useShortcuts'
import { useAutoAnswer } from './hooks/useAutoAnswer'
import { useTrends } from './hooks/useTrends'
import TrendStrip from './components/TrendStrip'

function Panel({ title, area, children }) {
  return (
    <section className="panel" style={{ gridArea: area }} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export default function App() {
  const [selectedHomeId, setSelectedHomeId] = useState(null)
  const [demoLayout, setDemoLayout] = useState(false)
  const [ventBlocked, setVentBlocked] = useState(false)

  const [pulseId, setPulseId] = useState(null)
  const [callHighlight, setCallHighlight] = useState(false)
  const lastCallHome = useRef(null)

  const onRunChange = useCallback(() => {
    setSelectedHomeId(null)
    setVentBlocked(false)
    setPulseId(null)
    setCallHighlight(false)
    lastCallHome.current = null
  }, [])

  const data = useDashboardData({ onRunChange })
  const series = useSeries(selectedHomeId, data.runId)
  const callHomeRec = data.call ? data.homes.find((h) => h.id === data.call.home_id) : null
  const voice = useAutoAnswer(data.call, callHomeRec)
  const trends = useTrends(data.runId)

  const actions = useSimActions({ state: data.state, ventBlocked, setVentBlocked, refresh: data.refresh })
  useShortcuts({
    b: () => actions.toggleBlock('B'),
    v: () => actions.toggleVent(),
    r: () => actions.reset(),
    d: () => setDemoLayout((v) => !v),
  })

  // Auto-focus: when a new call appears, select its home, pulse the marker and highlight the panel.
  const callHome = data.call ? data.call.home_id : null
  useEffect(() => {
    if (!callHome) {
      lastCallHome.current = null
      return undefined
    }
    if (lastCallHome.current === callHome) return undefined
    lastCallHome.current = callHome
    setSelectedHomeId(callHome)
    setPulseId(callHome)
    setCallHighlight(true)
    const t = setTimeout(() => {
      setPulseId(null)
      setCallHighlight(false)
    }, 3000)
    return () => clearTimeout(t)
  }, [callHome])

  return (
    <div className={`app${demoLayout ? ' demo' : ''}`} data-vent-blocked={ventBlocked} >
      <Header
        state={data.state}
        connection={data.connection}
        demoLayout={demoLayout}
        onToggleDemo={() => setDemoLayout((v) => !v)}
        extra={<ShortcutHelp />}
      />
      <Banner events={data.events} ready={data.state !== null} runId={data.runId} />
      <div className="summary">
        <KpiStrip homes={data.homes} state={data.state} />
        <Headline homes={data.homes} />
        <TrendStrip trends={trends} selectedId={selectedHomeId} />
      </div>
      <main className="grid">
        <Panel title="Map" area="map">
          <MapPanel
            homes={data.homes}
            blocks={data.state ? data.state.blocks : []}
            selectedId={selectedHomeId}
            onSelect={setSelectedHomeId}
            runKey={data.runId}
            pulseId={pulseId}
          />
        </Panel>
        <Panel title="Priority queue" area="queue">
          <PriorityQueue homes={data.homes} selectedId={selectedHomeId} onSelect={setSelectedHomeId} />
        </Panel>
        <Panel title="Home details" area="details">
          <HomeDetails
            home={data.homes.find((h) => h.id === selectedHomeId)}
            selectedId={selectedHomeId}
          />
          <TemperatureChart
            series={series.series}
            error={series.error}
            loading={series.loading}
            selectedId={selectedHomeId}
          />
        </Panel>
        <Panel title="AI check-in call" area="call">
          <CallPanel call={data.call} events={data.events} highlight={callHighlight} voice={voice} />
        </Panel>
        {!demoLayout && (
          <Panel title="Event log" area="events">
            <EventLog events={data.events} onSelect={setSelectedHomeId} />
          </Panel>
        )}
        <Panel title="Simulator controls" area="controls">
          <SimulatorControls state={data.state} ventBlocked={ventBlocked} actions={actions} />
        </Panel>
        {!demoLayout && (
          <Panel title="Accuracy" area="accuracy">
            <AccuracyPanel accuracy={data.accuracy} />
          </Panel>
        )}
      </main>
    </div>
  )
}
