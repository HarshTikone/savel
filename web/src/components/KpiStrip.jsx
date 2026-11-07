import { Home, Siren, AlertTriangle, ZapOff, HandHeart } from 'lucide-react'
import { getSummary } from '../data/mockHomes'
const cards = [
  { field: 'monitored', label: 'HOMES MONITORED', icon: Home, tone: 'default', sub: '4 response blocks' },
  { field: 'critical', label: 'CRITICAL HOMES', icon: Siren, tone: 'danger', sub: 'Immediate review' },
  { field: 'warning', label: 'WARNING STATUS', icon: AlertTriangle, tone: 'amber', sub: 'Cooling or elevated risk' },
  { field: 'outages', label: 'WITHOUT POWER', icon: ZapOff, tone: 'blue', sub: 'Simulated grid state' },
  { field: 'assistance', label: 'ASSISTANCE FLAGS', icon: HandHeart, tone: 'gold', sub: 'Scripted call outcomes' },
]
export default function KpiStrip({ homes }) {
  const stats = getSummary(homes)
  return <section className="kpi-row" aria-label="Simulation summary">
    {cards.map(({field, label, icon: Icon, tone, sub}) => <div className={`kpi kpi-${tone}`} key={field}>
      <div className="kpi-top"><span>{label}</span><Icon size={17}/></div>
      <strong>{stats[field]}</strong><small>{sub}</small>
    </div>)}
  </section>
}
