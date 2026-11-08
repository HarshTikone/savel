import { useState } from 'react'
import { Zap, ZapOff, Wind, RotateCcw, Check, Snowflake, Gauge, Building2 } from 'lucide-react'
import HouseStory from '../components/HouseStory'
import StatusPill from '../components/StatusPill'
import { useStory } from '../hooks/useStory'
import { rankOf } from '../lib/story'
import { homeColor } from '../lib/colors'
import { temp } from '../lib/format'
import { SPEED_PRESETS } from '../config'

const BLOCKS = ['A', 'B', 'C', 'D']

function HouseGrid({ homes, selectedId, onSelect, housesOff }) {
  return (
    <div className="hgrid">
      {BLOCKS.map((b) => (
        <div key={b} className="hblock">
          <div className="hblock-title">Block {b}</div>
          <div className="htiles">
            {homes.filter((h) => h.block === b).map((h) => (
              <button key={h.id} type="button" className={`htile${h.id === selectedId ? ' selected' : ''}`} style={{ '--c': homeColor(h) }} onClick={() => onSelect(h.id)}
                aria-label={`${h.id}, ${h.status}, ${temp(h.temp_f)}`}>
                <span className="htile-id">{h.id}</span>
                <span className="htile-temp">{h.temp_f != null ? `${Math.round(h.temp_f)}°` : '—'}</span>
                {housesOff.includes(h.id) && <ZapOff size={12} className="htile-off" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SimulationPage({ data, sim, onHelp, helpPending }) {
  const { homes, state, events, runId } = data
  const [picked, setPicked] = useState(null)
  const [vent, setVent] = useState({})
  const focusId = state ? state.focus_home : null
  const selectedId = picked || focusId || 'H-13'
  const home = homes.find((h) => h.id === selectedId)
  const rank = home ? rankOf(homes, home.id) : null
  const steps = useStory(home, rank, events, runId)
  const housesOff = (state && state.houses_off) || []
  const off = housesOff.includes(selectedId)
  const blocks = (state && state.blocks) || []

  return (
    <div className="page sim">
      <section className="card">
        <div className="card-head">
          <h2>Pick a house</h2>
          <span className="muted">Tiles show live indoor temperature</span>
        </div>
        <HouseGrid homes={homes} selectedId={selectedId} onSelect={setPicked} housesOff={housesOff} />
      </section>

      <section className="card control">
        {home ? (
          <>
            <div className="house-head">
              <div>
                <div className="house-id">{home.id} <span className="muted">Block {home.block}</span></div>
                <div className="house-badges"><StatusPill home={home} size="lg" />{rank && <span className="badge">Priority #{rank}</span>}</div>
              </div>
              <div className="big-temp">{home.temp_f != null ? home.temp_f.toFixed(1) : '—'}<span>°F</span></div>
            </div>
            <div className="actions">
              {off ? (
                <button type="button" className="btn-xl ok" disabled={sim.pending.house} onClick={() => sim.house('restore_house', home.id)}><Zap size={20} /> Restore power</button>
              ) : (
                <button type="button" className="btn-xl bad" disabled={sim.pending.house} onClick={() => sim.house('cut_house', home.id)}><ZapOff size={20} /> Cut power to {home.id}</button>
              )}
              <button type="button" className="btn-xl help" disabled={home.outcome === 'helped' || !!helpPending[home.id]} onClick={() => onHelp(home.id)}>
                <Check size={20} strokeWidth={3} /> {home.outcome === 'helped' ? 'Help delivered' : 'Deliver help'}
              </button>
              <button type="button" className="btn-xl ghost" disabled={sim.pending.vent} onClick={async () => { const on = !vent[home.id]; await sim.vent(on, home.id); setVent((v) => ({ ...v, [home.id]: on })) }}>
                <Wind size={18} /> {vent[home.id] ? 'Clear furnace vent' : 'Block furnace vent (CO)'}
              </button>
            </div>
            <h3>What happens next</h3>
            <HouseStory steps={steps} home={home} rank={rank} vertical />
          </>
        ) : <p className="muted">Waiting for data…</p>}
        {sim.error && <p className="error">{sim.error.detail}</p>}
      </section>

      <section className="card settings">
        <h2>Run</h2>
        <div className="row">
          <button type="button" className="btn primary" disabled={sim.pending.reset} onClick={() => { setVent({}); setPicked(null); sim.reset(0) }}><RotateCcw size={15} /> Reset (all homes warm)</button>
          <button type="button" className="btn" disabled={sim.pending.reset} onClick={() => { setVent({}); setPicked(null); sim.reset() }}><Snowflake size={15} /> Reset with Block B outage</button>
        </div>
        <h2><Gauge size={14} /> Storm speed</h2>
        <div className="seg">
          {SPEED_PRESETS.map((p) => (
            <button key={p.value} type="button" className={state && state.speed === p.value ? 'on' : ''} onClick={() => sim.speed(p.value)}>{p.label}</button>
          ))}
        </div>
        <h2><Building2 size={14} /> Whole-block outage</h2>
        <div className="row">
          {blocks.map((b) => (
            <button key={b.block} type="button" className={`btn${b.power_on ? '' : ' danger'}`} onClick={() => sim.block(b.block, b.power_on)}>
              {b.power_on ? <Zap size={14} /> : <ZapOff size={14} />} Block {b.block}
            </button>
          ))}
        </div>
        <p className="muted">Tip: show the Responder page on the projector and drive the demo from here in a second window.</p>
      </section>
    </div>
  )
}
