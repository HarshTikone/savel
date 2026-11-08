import { useEffect, useRef, useState } from 'react'
import { Phone, Check, HeartPulse } from 'lucide-react'
import StatusPill from './StatusPill'
import { rankedHomes } from '../lib/story'
import { stormDuration, temp } from '../lib/format'
import { CALL_STATUS_LABEL, OUTCOME_LABEL } from '../data/contract'
import { homeColor } from '../lib/colors'

const CAN_HELP = (h) => ['warning', 'critical'].includes(h.status) || ['needs_help', 'medical', 'unreachable'].includes(h.outcome)

export default function PriorityList({ homes, selectedId, onSelect, onHelp, pending = {} }) {
  const rows = rankedHomes(homes).slice(0, 12)
  const prev = useRef({})
  const [moved, setMoved] = useState({})
  useEffect(() => {
    const up = {}
    rows.forEach((h, i) => {
      const before = prev.current[h.id]
      if (before !== undefined && i < before) up[h.id] = true
    })
    prev.current = Object.fromEntries(rows.map((h, i) => [h.id, i]))
    if (Object.keys(up).length) {
      setMoved(up)
      const t = setTimeout(() => setMoved({}), 1600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [rows.map((h) => h.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (rows.length === 0) {
    return <div className="empty"><Check size={22} /><p>Every home is safe and heated.</p></div>
  }
  return (
    <ol className="plist">
      {rows.map((h, i) => (
        <li key={h.id} className={`prow${h.id === selectedId ? ' selected' : ''}${moved[h.id] ? ' moved' : ''}`} style={{ '--c': homeColor(h) }}>
          <button type="button" className="prow-main" onClick={() => onSelect(h.id)}>
            <span className="prank">{i + 1}</span>
            <span className="prow-body">
              <span className="prow-top">
                <strong>{h.id}</strong>
                <StatusPill home={h} size="sm" />
                {h.medical_needs && h.medical_needs.length > 0 && <HeartPulse size={14} className="ic-med" aria-label="Medical needs" />}
              </span>
              <span className="prow-sub">
                <span>{temp(h.temp_f)}</span>
                {h.hours_to_50 != null && <span>50°F in {stormDuration(h.hours_to_50)}</span>}
                {h.call_status !== 'none' && <span className="call-tag"><Phone size={11} /> {h.outcome !== 'none' ? OUTCOME_LABEL[h.outcome] : CALL_STATUS_LABEL[h.call_status]}</span>}
              </span>
              <span className="riskbar" aria-label={`Risk ${h.risk} of 100`}><span style={{ width: `${h.risk}%` }} /></span>
            </span>
            <span className="prisk">{h.risk}</span>
          </button>
          {CAN_HELP(h) && (
            <button type="button" className="help-mini" title={`Mark help delivered at ${h.id}`} aria-label={`Mark help delivered at ${h.id}`}
              disabled={!!pending[h.id]} onClick={() => onHelp(h.id)}>
              <Check size={16} strokeWidth={3} />
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}
