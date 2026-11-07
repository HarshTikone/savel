import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import homes from '../data/mock/homes.json'
import state from '../data/mock/state.json'
import { headline } from '../lib/derive'
import Header from '../components/Header'
import KpiStrip from '../components/KpiStrip'

describe('headline', () => {
  it('all heated', () => {
    const heated = homes.map((h) => ({ ...h, status: 'heated' }))
    expect(headline(heated)).toBe('All 40 homes heated. Cut power to a block to begin.')
  })
  it('mixed fixtures', () => {
    expect(headline(homes)).toBe('2 homes critical · next home reaches 50°F in 22m storm time')
  })
  it('empty', () => expect(headline([])).toMatch(/Waiting/))
})

describe('Header', () => {
  it('shows MOCK and never LIVE in mock mode', () => {
    render(<Header state={state} connection="mock" demoLayout={false} onToggleDemo={() => {}} />)
    expect(screen.getByText('MOCK')).toBeInTheDocument()
    expect(screen.queryByText('LIVE')).toBeNull()
    expect(screen.getByText('SIMULATION')).toBeInTheDocument()
    expect(screen.getByText('9:20 PM')).toBeInTheDocument()
  })
  it('shows slowed label during a live call', () => {
    render(<Header state={{ ...state, live_call: true }} connection="live" demoLayout={false} onToggleDemo={() => {}} />)
    expect(screen.getByText('Slowed for live call')).toBeInTheDocument()
  })
})

describe('KpiStrip', () => {
  it('counts match fixtures', () => {
    render(<KpiStrip homes={homes} state={state} />)
    const val = (label) => screen.getByText(label).previousSibling.textContent
    expect(val('Homes')).toBe('40')
    expect(val('Critical')).toBe('2')
    expect(val('Warning')).toBe('2')
    expect(val('Blocks without power')).toBe('1')
    expect(val('Offline sensors')).toBe('1')
  })
})
