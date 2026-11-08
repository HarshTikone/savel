import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { simClock } from '../lib/format'

const MEASURED = '#f4f4f5'
const ESTIMATED = '#a1a1aa'
const PREDICTED = '#3b82f6'

// Merge actual and predicted points by time. Measured and estimated runs each get their own key;
// the boundary point is shared so lines connect. No points are invented.
export function buildChartData(series) {
  const actual = (series && series.actual) || []
  const predicted = (series && series.predicted) || []
  const rows = new Map()
  const row = (t) => {
    const ms = new Date(t).getTime()
    if (!rows.has(ms)) rows.set(ms, { t: ms })
    return rows.get(ms)
  }
  actual.forEach((p, i) => {
    const r = row(p.t)
    if (p.est) r.estimated = p.temp_f
    else r.measured = p.temp_f
    const prev = actual[i - 1]
    if (prev && prev.est !== p.est) {
      const pr = row(prev.t)
      if (p.est) pr.estimated = prev.temp_f
      else pr.measured = prev.temp_f
    }
  })
  if (actual.length > 0 && predicted.length > 0) {
    const last = actual[actual.length - 1]
    row(last.t).predicted = last.temp_f
  }
  predicted.forEach((p) => {
    row(p.t).predicted = p.temp_f
  })
  const data = [...rows.values()].sort((a, b) => a.t - b.t)
  const nowT = actual.length > 0 ? new Date(actual[actual.length - 1].t).getTime() : null
  return { data, nowT }
}

export function yDomain(data) {
  const vals = data.flatMap((d) => [d.measured, d.estimated, d.predicted]).filter((v) => typeof v === 'number')
  const lo = Math.min(50, ...vals)
  const hi = Math.max(68, ...vals)
  return [Math.floor(lo - 2), Math.ceil(hi + 2)]
}

function Legend() {
  return (
    <ul className="chart-legend">
      <li><span className="line solid" style={{ borderColor: MEASURED }} />Measured</li>
      <li><span className="line dotted" style={{ borderColor: ESTIMATED }} />Estimated (sensor offline)</li>
      <li><span className="line dashed" style={{ borderColor: PREDICTED }} />Predicted</li>
    </ul>
  )
}

export default function TemperatureChart({ series, error, loading, selectedId, width, height = 230 }) {
  if (!selectedId) return <p className="muted">Select a home to see its temperature history.</p>
  if (error) return <p className="muted" role="alert">{error}</p>
  if (loading && !series) return <p className="muted">Loading readings…</p>
  if (!series || !series.actual || series.actual.length === 0) return <p className="muted">No readings yet</p>

  const { data, nowT } = buildChartData(series)
  const chart = (
    <LineChart data={data} width={width} height={width ? height : undefined} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid stroke="#2b2b2b" strokeDasharray="3 3" />
      <XAxis
        dataKey="t"
        type="number"
        scale="time"
        domain={['dataMin', 'dataMax']}
        tickFormatter={simClock}
        stroke="#a1a1aa"
        tick={{ fontSize: 12 }}
      />
      <YAxis domain={yDomain(data)} stroke="#a1a1aa" tick={{ fontSize: 12 }} unit="°" width={44} />
      <Tooltip
        labelFormatter={simClock}
        formatter={(v) => `${v}°F`}
        contentStyle={{ background: '#222222', border: '1px solid #3a3a3a', borderRadius: 8, color: '#f4f4f5', fontSize: 12 }} labelStyle={{ color: '#f4f4f5' }} itemStyle={{ color: '#f4f4f5' }}
      />
      <ReferenceLine y={60} stroke="#facc15" strokeDasharray="4 4" label={{ value: 'warning 60°F', fill: '#fde047', fontSize: 12, position: 'insideTopRight' }} />
      <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'critical 50°F', fill: '#f87171', fontSize: 12, position: 'insideBottomRight' }} />
      {nowT !== null && <ReferenceLine x={nowT} stroke="#a1a1aa" label={{ value: 'now', fill: '#a1a1aa', fontSize: 12, position: 'top' }} />}
      <Line dataKey="measured" stroke={MEASURED} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} name="Measured" />
      <Line dataKey="estimated" stroke={ESTIMATED} strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={false} connectNulls={false} name="Estimated" />
      <Line dataKey="predicted" stroke={PREDICTED} strokeWidth={2} strokeDasharray="8 4" dot={false} isAnimationActive={false} connectNulls={false} name="Predicted" />
    </LineChart>
  )

  return (
    <div className="chart-wrap">
      <Legend />
      {width ? chart : <ResponsiveContainer width="100%" height={height}>{chart}</ResponsiveContainer>}
    </div>
  )
}
