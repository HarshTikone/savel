import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatSimTime, mockEvents } from '../data/mockHomes'
export default function EventLog() {
  return <section className="panel event-panel">
    <div className="panel-head"><div><div className="eyebrow">AUDIT STREAM / SYNTHETIC EVENTS</div><h2>Incident activity</h2></div><span className="count-badge">LATEST</span></div>
    <div className="event-list">{mockEvents.map((e,i)=><div className="event-row" key={i}>
      <span className={`event-icon event-${e.severity}`}>{e.severity==='critical'?<AlertTriangle size={14}/>:e.severity==='warning'?<Activity size={14}/>:<CheckCircle2 size={14}/>}</span>
      <div><b>{e.home_id || e.type}</b> <span>{e.text}</span><small>SIM {formatSimTime(e.t)} EST · {e.type}</small></div>
    </div>)}</div>
  </section>
}
