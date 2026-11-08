import { STATUS_META } from '../data/contract'
import { markerStyle, ALARM } from '../lib/colors'
import { stormDuration } from '../lib/format'

const BLOCKS = ['A', 'B', 'C', 'D']
const BW = 250
const BH = 130

export default function BlockGridMap({ homes, blocks = [], selectedId, onSelect, pulseId }) {
  const powerOf = (b) => {
    const entry = blocks.find((x) => x.block === b)
    return entry ? entry.power_on : true
  }
  return (
    <svg className="grid-map" viewBox={`0 0 ${BW * 2 + 30} ${BH * 2 + 50}`} role="group" aria-label="Block grid map">
      {BLOCKS.map((b, bi) => {
        const ox = 10 + (bi % 2) * (BW + 10)
        const oy = 10 + Math.floor(bi / 2) * (BH + 30)
        const on = powerOf(b)
        const list = homes.filter((h) => h.block === b).sort((a, c) => a.id.localeCompare(c.id))
        return (
          <g key={b} transform={`translate(${ox},${oy})`}>
            <rect width={BW} height={BH + 14} rx="8" fill="none" stroke={on ? '#3a3a3a' : ALARM} strokeWidth="2" strokeDasharray={on ? undefined : '6 4'} />
            <text x="8" y="16" fill="#a1a1aa" fontSize="12">{on ? `Block ${b}` : `Block ${b} · no power`}</text>
            {list.map((h, i) => {
              const x = 24 + (i % 5) * 46
              const y = 34 + Math.floor(i / 5) * 54
              const st = markerStyle(h, h.id === selectedId)
              const label = `Home ${h.id}, ${STATUS_META[h.status]?.label ?? h.status}, ${h.temp_f}°F, ${stormDuration(h.hours_to_50)}`
              return (
                <g
                  key={h.id}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  className={h.id === pulseId ? 'pulse' : undefined}
                  onClick={() => onSelect(h.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(h.id)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <path
                    d={`M${x - 16},${y + 8} L${x},${y - 10} L${x + 16},${y + 8} L${x + 16},${y + 28} L${x - 16},${y + 28} Z`}
                    fill={st.fillColor}
                    fillOpacity={st.fillOpacity}
                    stroke={st.color}
                    strokeWidth={st.weight}
                    strokeDasharray={st.dashArray}
                  />
                  <text x={x} y={y + 22} textAnchor="middle" fontSize="9" fill="#111111" fontWeight="700">{h.id.replace('H-', '')}</text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
