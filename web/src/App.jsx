import { useCallback, useState } from 'react'
import { useDashboardData } from './hooks/useDashboardData'
import { useSeries } from './hooks/useSeries'
import Header from './components/Header'
import KpiStrip from './components/KpiStrip'
import Headline from './components/Headline'
import MapPanel from './components/MapPanel'
import PriorityQueue from './components/PriorityQueue'
import HomeDetails from './components/HomeDetails'

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

  const onRunChange = useCallback(() => {
    setSelectedHomeId(null)
    setVentBlocked(false)
  }, [])

  const data = useDashboardData({ onRunChange })
  const series = useSeries(selectedHomeId, data.runId)

  return (
    <div className={`app${demoLayout ? ' demo' : ''}`} data-vent-blocked={ventBlocked} data-series={series.series ? 'yes' : 'no'}>
      <Header
        state={data.state}
        connection={data.connection}
        demoLayout={demoLayout}
        onToggleDemo={() => setDemoLayout((v) => !v)}
      />
      <div className="summary">
        <KpiStrip homes={data.homes} state={data.state} />
        <Headline homes={data.homes} />
      </div>
      <main className="grid">
        <Panel title="Map" area="map">
          <MapPanel
            homes={data.homes}
            blocks={data.state ? data.state.blocks : []}
            selectedId={selectedHomeId}
            onSelect={setSelectedHomeId}
            runKey={data.runId}
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
        </Panel>
        <Panel title="AI check-in call" area="call" />
        {!demoLayout && <Panel title="Event log" area="events" />}
        <Panel title="Simulator controls" area="controls" />
        {!demoLayout && <Panel title="Accuracy" area="accuracy" />}
      </main>
    </div>
  )
}
