import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import homes from '../data/mock/homes.json'
import state from '../data/mock/state.json'
import { reachedNow, rankedHomes, STORY_STEPS } from '../lib/story'
import { homeColor, STATUS_COLOR } from '../lib/colors'

vi.mock('../components/HomeMap', () => ({ default: () => <div data-testid="map" /> }))
vi.mock('../hooks/useSeries', () => ({ useSeries: () => ({ series: null, error: null, loading: false }) }))

import ResponderPage from '../pages/ResponderPage'
import SimulationPage from '../pages/SimulationPage'

const base = { id: 'H-13', block: 'B', temp_f: 55, co_ppm: 0, power_on: false, heating: false, online: true,
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
