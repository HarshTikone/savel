import { useEffect, useRef, useState } from 'react'
import { QUEUE_SIZE } from '../config'
import { STATUS_META, CALL_STATUS_LABEL } from '../data/contract'
import { ppm, stormDuration, temp } from '../lib/format'

export function queueRows(homes) {
  return homes.filter((h) => h.status !== 'heated').slice(0, QUEUE_SIZE)
}

export function countdownText(h) {
  if (h.co_ppm >= 35) return `CO ${ppm(h.co_ppm)}`
  if (h.hours_to_50 === 0) return 'below 50°F'
  if (h.hours_to_50 === null || h.hours_to_50 === undefined) return '—'
  return `${stormDuration(h.hours_to_50)} to 50°F`
}

function tagsFor(h) {
  const tags = []
  if (h.age_band === '65-74' || h.age_band === '75+') tags.push(h.age_band)
  for (const m of h.medical_needs || []) tags.push(m)
  if (h.language && h.language !== 'en') tags.push(h.language)
  if (h.online === false) tags.push('estimated')
  return tags
}

export default function PriorityQueue({ homes, selectedId, onSelect }) {
  const rows = queueRows(homes)
  const prevRanks = useRef({})
  const [moved, setMoved] = useState({})

  useEffect(() => {
    const next = {}
    const up = {}
    rows.forEach((h, i) => {
      next[h.id] = i
      if (prevRanks.current[h.id] !== undefined && i < prevRanks.current[h.id]) up[h.id] = true
    })
    prevRanks.current = next
    if (Object.keys(up).length === 0) return undefined
    setMoved((m) => ({ ...m, ...up }))
    const t = setTimeout(() => setMoved({}), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((h) => h.id).join(',')])

  if (rows.length === 0) return <p className="muted">No homes need attention.</p>

  return (
    <ol className="queue">
      {rows.map((h, i) => {
        const meta = STATUS_META[h.status]
        const Icon = meta.icon
        const tags = tagsFor(h)
        const select = () => onSelect(h.id)
        return (
          <li
            key={h.id}
            role="button"
            tabIndex={0}
            aria-pressed={h.id === selectedId}
            className={`queue-row${h.id === selectedId ? ' selected' : ''}${moved[h.id] ? ' moved' : ''}`}
            onClick={select}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                select()
              }
            }}
          >
            <span className="rank mono" style={{ background: `var(${meta.colorVar})` }}>{i + 1}</span>
            <div className="queue-main">
              <div className="queue-title">
                <strong>{h.id}</strong>
                <span className="muted">Block {h.block}</span>
                <span className="status-chip" style={{ color: `var(${meta.colorVar})` }}>
                  <Icon size={13} aria-hidden="true" /> {meta.label}
                </span>
              </div>
              <div className="queue-sub mono">
                {temp(h.temp_f)} · risk {h.risk}
                {tags.map((t) => <span key={t} className="tag">{t}</span>)}
                <span className="tag call">{CALL_STATUS_LABEL[h.call_status] ?? h.call_status}</span>
              </div>
            </div>
            <span className="countdown mono">{countdownText(h)}</span>
          </li>
        )
      })}
    </ol>
  )
}
