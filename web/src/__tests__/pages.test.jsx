import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import homes from '../data/mock/homes.json'
import state from '../data/mock/state.json'
import { reachedNow, rankedHomes, STORY_STEPS, withCall } from '../lib/story'
import { homeColor, STATUS_COLOR } from '../lib/colors'

vi.mock('../components/HomeMap', () => ({ default: () => <div data-testid="map" /> }))
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
    expect([...r]).toEqual(['cut', 'cooling', 'threshold', 'ranked', 'call'])
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

import { IncomingCalls } from '../components/CallPanel'

describe('incoming calls', () => {
  const ring = (id, left) => ({ home_id: id, source: 'live', phase: 'ringing', ring_left_s: left, transcript: [] })
  const idle = () => ({ activeHome: null, status: 'idle', busy: false, ended: false, error: '', answer: vi.fn(), decline: vi.fn(), hangUp: vi.fn(), liveLines: [] })
  it('shows one card per ringing house with Answer, Decline and a countdown', () => {
    const voice = idle()
    render(<IncomingCalls calls={[ring('H-31', 24), ring('H-32', 9), { home_id: 'H-11', source: 'live', phase: 'done' }]} voice={voice} />)
    expect(screen.getAllByText('Answer')).toHaveLength(2)
    expect(screen.getByText('Ringing · drops in 24 s')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('Answer')[0])
    expect(voice.answer).toHaveBeenCalledWith(expect.objectContaining({ home_id: 'H-31' }))
    fireEvent.click(screen.getAllByText('Decline')[1])
    expect(voice.decline).toHaveBeenCalledWith('H-32')
  })
  it('other houses keep ringing while one call is in progress', () => {
    const voice = { ...idle(), activeHome: 'H-31', status: 'talking', busy: true }
    render(<IncomingCalls calls={[ring('H-31', 20), ring('H-32', 15)]} voice={voice} />)
    expect(screen.getByText(/On the call with H-31/)).toBeInTheDocument()
    expect(screen.getByText('Busy')).toBeDisabled()
    fireEvent.click(screen.getByText('Hang up'))
    expect(voice.hangUp).toHaveBeenCalled()
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
    const calls = [
      { home_id: 'H-13', phase: 'in_call', source: 'live', outcome: 'none', last: 'Resident: it is freezing' },
      { home_id: 'H-27', phase: 'ringing', source: 'live', outcome: 'none', last: '', ring_left_s: 12 },
      { home_id: 'H-14', phase: 'done', source: 'live', outcome: 'medical', result: 'medical', last: '' },
      { home_id: 'H-16', phase: 'no_answer', source: 'live', outcome: 'helped', result: 'unreachable', last: '' },
    ]
    render(<AgentPage data={data} voice={null} calls={calls} />)
    expect(screen.getByText('Not answered', { selector: '.tile-label' }).previousSibling.textContent).toBe('1')   // still counted after help
    expect(screen.getByText('✓ Delivered')).toBeInTheDocument()
    expect(screen.getByText('Calling right now', { selector: '.tile-label' }).previousSibling.textContent).toBe('2')
    expect(screen.getByText('Areas being called').previousSibling.textContent).toBe('2')
    expect(screen.getByText('Resident: it is freezing')).toBeInTheDocument()
    expect(screen.getByText('Medical')).toBeInTheDocument()
  })
})

import { useStory, _resetStoriesForTests } from '../hooks/useStory'

describe('story lifecycle', () => {
  it('clears 12 s after it finishes, survives remounts, and restarts on the next incident', () => {
    _resetStoriesForTests()
    const done = { ...base, power_on: true, heating: true, status: 'heated', outcome: 'helped', trend: 'heating', call_status: 'done', call_result: 'ok' }
    const t0 = 1_000_000
    useStory({ ...base, call_status: 'done', outcome: 'ok', call_result: 'ok' }, 1, [], 'r1', t0 - 1000)   // seen during the incident
    expect(useStory(done, null, [], 'r1', t0).every((s) => s.state === 'done')).toBe(true)
    expect(useStory(done, null, [], 'r1', t0 + 5000).cleared).toBe(false)
    const cleared = useStory(done, null, [], 'r1', t0 + 13000)
    expect(cleared.cleared && cleared.every((s) => s.state === 'todo')).toBe(true)
    expect(useStory(done, null, [], 'r1', t0 + 20000).cleared).toBe(true)          // stays clear (memo outlives the page)
    const cut = useStory({ ...base, power_on: false, heating: false, status: 'cooling', outcome: 'none', call_status: 'none' }, null, [], 'r1', t0 + 21000)
    expect(cut[0].state).toBe('done')
    expect(cut[5].state).toBe('todo')                                              // help not pre-ticked
  })
  it('a call that was not answered stays red after help is delivered', () => {
    _resetStoriesForTests()
    const steps = useStory({ ...base, power_on: true, heating: true, status: 'recovering', call_status: 'done', outcome: 'helped', call_result: 'unreachable' }, null, [], 'r3', 0)
    expect(steps.find((s) => s.key === 'call').state).toBe('failed')
    expect(steps.find((s) => s.key === 'help').state).toBe('done')
  })
  it('a ringing call is in progress, not ticked', () => {
    _resetStoriesForTests()
    const h = withCall({ ...base, call_status: 'ringing' }, { phase: 'ringing', ring_left_s: 21, result: null })
    const steps = useStory(h, 1, [], 'r4', 0)
    expect(steps.find((s) => s.key === 'ranked').state).toBe('done')
    expect(steps.find((s) => s.key === 'call').state).toBe('current')
    const declined = withCall({ ...base, call_status: 'ringing' }, { phase: 'no_answer', result: 'unreachable' })
    expect(useStory(declined, 1, [], 'r4', 1000).find((s) => s.key === 'call').state).toBe('failed')   // red at once
  })
  it('help before any call result shows a grey dash, not a green tick', () => {
    _resetStoriesForTests()
    const steps = useStory({ ...base, power_on: true, heating: true, status: 'recovering', call_status: 'done', outcome: 'helped', call_result: null }, null, [], 'r5', 0)
    expect(steps.find((s) => s.key === 'call').state).toBe('skipped')
  })
  it('a finished incident does not replay after a reload', () => {
    _resetStoriesForTests()
    const done = { ...base, power_on: true, heating: true, status: 'heated', outcome: 'helped', trend: 'heating', call_status: 'done', call_result: 'ok' }
    expect(useStory(done, null, [], 'r6', 0).cleared).toBe(true)
  })
  it('an unanswered call shows red and the story carries on', () => {
    _resetStoriesForTests()
    const steps = useStory({ ...base, call_status: 'unreachable', outcome: 'unreachable' }, 1, [], 'r2', 0)
    expect(steps.find((s) => s.key === 'call').state).toBe('failed')
    expect(steps.find((s) => s.key === 'ranked').state).toBe('done')
  })
})
