const LABEL = {
  declining: 'Steady decline', slowing: 'Slowing', flat: 'Flat', rising: 'Rising',
  noisy: 'Noisy', insufficient: 'Collecting readings',
}

export default function TrendStrip({ trends, selectedId }) {
  const blocks = (trends && trends.blocks) || []
  const sel = selectedId && trends && trends.homes ? trends.homes[selectedId] : null
  if (blocks.length === 0) return null
  return (
    <div className="trend-strip" aria-label={`Trend check, last ${trends.window} readings`}>
      <span className="muted">Trend check (last {trends.window} readings):</span>
      {blocks.map((b) => (
        <span key={b.block} className={`chip${b.confirmed ? ' bad' : ''}`}>{b.summary}</span>
      ))}
      {sel && (
        <span className="chip">
          {selectedId}: {LABEL[sel.label] || sel.label}
          {sel.slope_f_per_h !== null && sel.slope_f_per_h !== undefined ? `, ${sel.slope_f_per_h.toFixed(1)} F/h` : ''}
          {sel.fit !== null && sel.fit !== undefined ? `, fit ${Math.round(sel.fit * 100)}%` : ''}
        </span>
      )}
    </div>
  )
}
