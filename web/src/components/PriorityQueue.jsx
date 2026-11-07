import { AlertCircle, ChevronRight, Radio } from 'lucide-react'
import RiskBadge from './RiskBadge'
function callLabel(status) { return ({completed:'Answered',queued:'Queued',no_answer:'No answer',not_called:'Not called'})[status] || status || 'Unknown' }
export default function PriorityQueue({ homes, selectedId, onSelect }) {
  const list = [...homes].sort((a,b)=> b.risk-a.risk || a.id.localeCompare(b.id)).slice(0,10)
  return <section className="panel queue-panel">
    <div className="panel-head"><div><div className="eyebrow">THREAT PRIORITIZATION / MOCK SCORES</div><h2>Priority response queue</h2></div><span className="count-badge">TOP 10</span></div>
    <div className="queue-list" role="list">{list.map((h,i)=><button type="button" role="listitem" key={h.id} className={`queue-item ${selectedId===h.id ? 'queue-selected':''}`} onClick={()=>onSelect(h.id)}>
      <span className="queue-index">{String(i+1).padStart(2,'0')}</span>
      <span className="queue-home"><strong>{h.id}</strong><small>BLOCK {h.block} · {h.temp_f}°F</small></span>
      <span className="queue-status"><RiskBadge status={h.status} compact/><small><Radio size={10}/>{callLabel(h.call_status)}</small></span>
      <span className="queue-hazard">{h.co_ppm>=35 ? <><AlertCircle size={12}/> CO {h.co_ppm} ppm</> : <>{Number.isFinite(h.hours_to_50) ? `${h.hours_to_50}h` : '—'} <small>to 50°F</small></>}</span>
      <span className="risk-number">{h.risk}<small>/100</small></span><ChevronRight size={15} className="queue-chevron" />
    </button>)}</div>
    <div className="panel-foot">Scores are fictional fixtures in mock mode; backend owns actual rankings.</div>
  </section>
}
