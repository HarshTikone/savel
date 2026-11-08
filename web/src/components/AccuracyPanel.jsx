const cell = (rows, horizon, source) => rows.find((r) => r.horizon_min === horizon && r.k_source === source)

export function accuracySentence(rows) {
  const learned = cell(rows, 60, 'learned')
  const global = cell(rows, 60, 'global')
  if (!learned || !global) return null
  if (!(learned.n > 0) || !(global.n > 0)) return null
  if (learned.mae_f === null || global.mae_f === null) return null
  if (!(learned.mae_f < global.mae_f)) return null
  return `Learning each home's insulation cut 60-minute error from ${global.mae_f}°F to ${learned.mae_f}°F.`
}

function Cell({ row }) {
  if (!row || row.mae_f === null || row.mae_f === undefined || !(row.n > 0)) {
    return <td className="muted">Insufficient observations</td>
  }
  return (
    <td className="mono">
      {row.mae_f}°F <span className="muted">n={row.n}</span>
    </td>
  )
}

export default function AccuracyPanel({ accuracy }) {
  const rows = Array.isArray(accuracy) ? accuracy : []
  const sentence = accuracySentence(rows)
  return (
    <div className="accuracy">
      <table>
        <thead>
          <tr>
            <th scope="col">Horizon</th>
            <th scope="col">Learned</th>
            <th scope="col">Global</th>
          </tr>
        </thead>
        <tbody>
          {[30, 60].map((h) => (
            <tr key={h}>
              <th scope="row">{h} min</th>
              <Cell row={cell(rows, h, 'learned')} />
              <Cell row={cell(rows, h, 'global')} />
            </tr>
          ))}
        </tbody>
      </table>
      {sentence && <p className="accuracy-claim">{sentence}</p>}
    </div>
  )
}
