import { kpiCounts } from '../lib/derive'

export default function KpiStrip({ homes, state }) {
  const k = kpiCounts(homes, state)
  const items = [
    ['Homes', k.total],
    ['Critical', k.critical],
    ['Warning', k.warning],
    ['Blocks without power', k.blocksWithoutPower],
    ['Calls needing help', k.needHelp],
    ['Offline sensors', k.offline],
  ]
  return (
    <ul className="kpi-strip" aria-label="Key numbers">
      {items.map(([label, value]) => (
        <li key={label} className="kpi">
          <span className="kpi-value mono">{value}</span>
          <span className="kpi-label">{label}</span>
        </li>
      ))}
    </ul>
  )
}
