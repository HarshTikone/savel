import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import homes from '../data/mock/homes.json'
import state from '../data/mock/state.json'
import { reachedNow, rankedHomes, STORY_STEPS } from '../lib/story'
import { homeColor, STATUS_COLOR } from '../lib/colors'

vi.mock('../components/HomeMap', () => ({ default: () => <div data-testid="map" /> }))
vi.mock('../hooks/useCalls', () => ({ useCalls: () => [
  { home_id: 'H-13', phase: 'in_call', source: 'live', outcome: 'none', last: 'Resident: it is freezing' },
  { home_id: 'H-27', phase: 'ringing', source: 'scripted', outcome: 'none', last: '' },
  { home_id: 'H-14', phase: 'done', source: 'scripted', outcome: 'medical', last: '' },
] }))
vi.mock('../hooks/useSeries', () => ({ useSeries: () => ({ series: null, error: null, loading: false }) }))

import ResponderPage from '../pages/ResponderPage'
import SimulationPage from '../pages/SimulationPage'
import AgentPage from '../pages/AgentPage'

const base = { trend: 'falling', slope_f_per_h: -7.5, id: 'H-13', block: 'B', temp_f: 55, co_ppm: 0, power_on: false, heating: false, online: true,
  k_est: 0.14, status: 'warning', risk: 90, call_status: 'none', outcome: 'none', hours_to_50: 1.2, hours_to_60: 0, medical_needs: ['oxygen'] }

describe('story', () => {
  it('walks the steps from data', () => {
    expect(reachedNow({ ...base, status: 'heated', heating: true, power_on: true }, null, [])).toEqual(new Set())
    const r = reachedNow({ ...base, call_status: 'done', outcome: 'medical' }, 1, [])
    expect([...r]).toEqual(['cut', 'cooling', 'threshold', 'call', 'ranked'])
    const back = reachedNow({ ...base, power_on: true, heating: true, status: 'heated', outcome: 'helped' }, null, [])
    expect(back.has('help') && back.has('normal')).toBe(true)
    expect(STORY_STEPS).toHaveLength(7)
  })
  it('a new power cut starts the story over', () => {
    const events = [
      { type: 'house_power_cut', home_id: 'H-13' },
      { type: 'help_delivered', home_id: 'H-13' },
      { type: 'threshold', home_id: 'H-13' },
      { type: 'house_power_cut', home_id: 'H-13' },
    ]
    const r = reachedNow({ ...base, status: 'cooling' }, 1, events)
    expect([...r]).toEqual(['cut', 'cooling'])
  })
  it('helped and heated homes leave the priority list', () => {
    const list = rankedHomes([base, { ...base, id: 'H-14', risk: 95, outcome: 'helped' }, { ...base, id: 'H-15', risk: 0, status: 'heated' }])
    expect(list.map((h) => h.id)).toEqual(['H-13'])
  })
  it('recovering fades from orange to green', () => {
    expect(homeColor({ status: 'recovering', temp_f: 48 })).toBe(STATUS_COLOR.warning)
    expect(homeColor({ status: 'recovering', temp_f: 62 })).toBe(STATUS_COLOR.heated)
  })
})

const data = { homes, state: { ...state, focus_home: 'H-13', houses_off: ['H-13'] }, events: [], call: null, runId: 'r1', refresh: async () => {} }

describe('pages', () => {
  it('responder page shows the story, priority list and help button', () => {
    const onHelp = vi.fn()
    render(<ResponderPage data={data} voice={null} trends={{ blocks: [], homes: {} }} onHelp={onHelp} helpPending={{}} />)
    expect(screen.getByLabelText('Story for H-13')).toBeInTheDocument()
    expect(screen.getByText('Priority list')).toBeInTheDocument()
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })
  it('simulation page cuts and restores the selected house', () => {
    const sim = { pending: {}, error: null, house: vi.fn(), vent: vi.fn(), block: vi.fn(), speed: vi.fn(), reset: vi.fn() }
    render(<SimulationPage data={data} sim={sim} onHelp={vi.fn()} helpPending={{}} />)
    fireEvent.click(screen.getByText('Restore power'))
    expect(sim.house).toHaveBeenCalledWith('restore_house', 'H-13')
    fireEvent.click(screen.getByLabelText(/^H-27,/))
    fireEvent.click(screen.getByText('Cut power to H-27'))
    expect(sim.house).toHaveBeenCalledWith('cut_house', 'H-27')
    fireEvent.click(screen.getByText(/Reset \(all homes warm\)/))
    expect(sim.reset).toHaveBeenCalledWith(0)
  })
})

import { IncomingCall } from '../components/CallPanel'

describe('incoming call', () => {
  const ringing = { home_id: 'H-13', source: 'live', phase: 'ringing', transcript: [] }
  it('shows Answer and Decline while ringing', () => {
    const voice = { status: 'idle', ended: false, error: '', answer: vi.fn(), decline: vi.fn(), hangUp: vi.fn(), liveLines: [] }
    render(<IncomingCall call={ringing} voice={voice} />)
    fireEvent.click(screen.getByText('Answer'))
    fireEvent.click(screen.getByText('Decline'))
    expect(voice.answer).toHaveBeenCalled()
    expect(voice.decline).toHaveBeenCalled()
  })
  it('shows Hang up during the call and nothing for scripted calls', () => {
    const voice = { status: 'talking', ended: false, error: '', answer: vi.fn(), decline: vi.fn(), hangUp: vi.fn(), liveLines: [] }
    const { rerender } = render(<IncomingCall call={{ ...ringing, phase: 'in_call' }} voice={voice} />)
    fireEvent.click(screen.getByText('Hang up'))
    expect(voice.hangUp).toHaveBeenCalled()
    rerender(<IncomingCall call={{ ...ringing, source: 'scripted' }} voice={voice} />)
    expect(screen.queryByText('Hang up')).toBeNull()
  })
})

import CallsBoard from '../components/CallsBoard'

describe('calls board', () => {
  it('shows one card per called house', () => {
    const onSelect = vi.fn()
    render(<CallsBoard selectedId={null} onSelect={onSelect} calls={[
      { home_id: 'H-13', phase: 'ringing', source: 'live', outcome: 'none' },
      { home_id: 'H-14', phase: 'done', source: 'scripted', outcome: 'medical' },
      { home_id: 'H-16', phase: 'no_answer', source: 'scripted', outcome: 'unreachable' },
    ]} />)
    expect(screen.getByText('1 in progress · 3 houses called')).toBeInTheDocument()
    expect(screen.getByText('Medical')).toBeInTheDocument()
    fireEvent.click(screen.getByText('H-16'))
    expect(onSelect).toHaveBeenCalledWith('H-16')
  })
})

describe('AI agent page', () => {
  it('shows who the agent is calling right now and by area', () => {
    render(<AgentPage data={data} voice={null} />)
    expect(screen.getByText('Calling right now', { selector: '.tile-label' }).previousSibling.textContent).toBe('2')
    expect(screen.getByText('Areas being called').previousSibling.textContent).toBe('2')
    expect(screen.getByText('Resident: it is freezing')).toBeInTheDocument()
    expect(screen.getByText('Medical')).toBeInTheDocument()
  })
})
