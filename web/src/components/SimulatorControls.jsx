import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DATA_MODE, SPEED_PRESETS, VENT_HOME } from '../config'
import { speedLabel } from '../lib/format'

const BLOCKS = ['A', 'B', 'C', 'D']

function Spin({ on }) {
  return on ? <Loader2 size={14} className="spin" aria-label="Working" /> : null
}

export default function SimulatorControls({ state, ventBlocked, actions }) {
  const { pending, error, powerOn, toggleBlock, toggleVent, setOutdoor, setSpeed, reset } = actions
  const outdoor = state ? state.outdoor_f : 0
  const [slider, setSlider] = useState(outdoor)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) setSlider(outdoor)
  }, [outdoor, dragging])

  const commit = () => {
    setDragging(false)
    if (Number(slider) !== outdoor) setOutdoor(Number(slider))
  }

  return (
    <div className="controls">
      {DATA_MODE === 'mock' && <p className="muted">Mock mode: no backend changes</p>}

      <div className="ctl-group" role="group" aria-label="Block power">
        {BLOCKS.map((b) => {
          const on = powerOn(b)
          return (
            <button
              key={b}
              type="button"
              className="btn"
              aria-pressed={!on}
              disabled={!!pending[`block-${b}`] || !state}
              onClick={() => toggleBlock(b)}
            >
              Block {b} · {on ? 'cut power' : 'restore power'} <Spin on={pending[`block-${b}`]} />
            </button>
          )
        })}
      </div>

      <div className="ctl-group">
        <button type="button" className="btn" disabled={!!pending.vent} onClick={toggleVent}>
          {ventBlocked ? `Clear vent at ${VENT_HOME}` : `Block vent at ${VENT_HOME}`} <Spin on={pending.vent} />
        </button>
      </div>

      <div className="ctl-group">
        <label htmlFor="outdoor">
          Outdoor <span className="mono">{state ? `${state.outdoor_f}°F` : '—'}</span>
        </label>
        <input
          id="outdoor"
          type="range"
          min="-10"
          max="30"
          step="1"
          value={slider}
          disabled={!!pending.outdoor || !state}
          onChange={(e) => {
            setDragging(true)
            setSlider(e.target.value)
          }}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
        />
        <span className="mono muted">{slider}°F</span>
        <Spin on={pending.outdoor} />
      </div>

      <div className="ctl-group" role="group" aria-label="Storm speed">
        <span className="muted">Speed {state ? speedLabel(state.speed) : '—'}</span>
        {SPEED_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className="btn"
            aria-pressed={state ? state.speed === p.value : false}
            disabled={!!pending.speed}
            onClick={() => setSpeed(p.value)}
          >
            {p.label}
          </button>
        ))}
        <Spin on={pending.speed} />
        {state && state.live_call && <span className="pill slowed">Slowed for live call</span>}
      </div>

      <div className="ctl-group">
        <button type="button" className="btn" disabled={!!pending['reset-warm']} onClick={() => reset()}>
          Reset (pre-warmed) <Spin on={pending['reset-warm']} />
        </button>
        <button type="button" className="btn" disabled={!!pending['reset-clean']} onClick={() => reset(0)}>
          Reset (clean start) <Spin on={pending['reset-clean']} />
        </button>
      </div>

      {error && <p className="ctl-error" role="alert">{error.detail}</p>}
    </div>
  )
}
