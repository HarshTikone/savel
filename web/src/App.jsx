import { useMemo, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { mockHomes } from './data/mockHomes'
import Header from './components/Header'
import KpiStrip from './components/KpiStrip'
import HomeMap from './components/HomeMap'
import PriorityQueue from './components/PriorityQueue'
import HomeDetails from './components/HomeDetails'
import CallPanel from './components/CallPanel'
import EventLog from './components/EventLog'
import SimulatorControls from './components/SimulatorControls'
import AccuracyPanel from './components/AccuracyPanel'

function App() {
  const [selectedHomeId, setSelectedHomeId] = useState('H-07')
  const selectedHome = useMemo(() => mockHomes.find(h => h.id === selectedHomeId) ?? mockHomes[0], [selectedHomeId])
  return <div className="app-shell">
    <Header/>
    <main className="content-shell">
      <div className="page-intro"><div><div className="section-id">SAVEL / COMMAND OPERATIONS / BUFFALO REGION</div><h1>Winter storm situational overview</h1><p>Prioritizing household safety through simulation-based sensor intelligence and human-reviewed outreach.</p></div><div className="page-status"><span className="mock-pulse"/> DEMO ENVIRONMENT · 40 SYNTHETIC HOMES</div></div>
      <KpiStrip homes={mockHomes}/>
      <div className="primary-grid"><HomeMap homes={mockHomes} selectedId={selectedHomeId} onSelect={setSelectedHomeId}/><PriorityQueue homes={mockHomes} selectedId={selectedHomeId} onSelect={setSelectedHomeId}/></div>
      <div className="lower-grid"><HomeDetails home={selectedHome}/><div className="right-stack"><CallPanel/><EventLog/></div></div>
      <div className="footer-grid"><SimulatorControls home={selectedHome}/><AccuracyPanel/></div>
      <footer className="app-footer"><span>SAVEL · Situational Awareness, Vulnerability Evaluation & Logistics</span><span>UNIVERSITY HACKATHON PROTOTYPE · NOT FOR OPERATIONAL USE</span></footer>
    </main>
  </div>
}
export default App
