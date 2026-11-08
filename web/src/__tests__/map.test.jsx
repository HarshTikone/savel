import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import homes from '../data/mock/homes.json'
import state from '../data/mock/state.json'
import BlockGridMap from '../components/BlockGridMap'
import MapLegend from '../components/MapLegend'
import { markerStyle, STATUS_COLOR } from '../lib/colors'

describe('BlockGridMap', () => {
  it('renders 40 selectable homes and selects on click', () => {
    const onSelect = vi.fn()
    render(<BlockGridMap homes={homes} blocks={state.blocks} selectedId={null} onSelect={onSelect} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(40)
    fireEvent.click(screen.getByLabelText(/^Home H-13,/))
    expect(onSelect).toHaveBeenCalledWith('H-13')
  })
  it('labels a block without power', () => {
    render(<BlockGridMap homes={homes} blocks={state.blocks} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('Block B · no power')).toBeInTheDocument()
  })
})

describe('MapLegend', () => {
  it('shows the five statuses', () => {
    render(<MapLegend />)
    for (const l of ['Heated', 'Cooling', 'Warning', 'Critical', 'Safe, leaving']) {
      expect(screen.getByText(l)).toBeInTheDocument()
    }
  })
})

describe('markerStyle', () => {
  it('uses backend status only', () => {
    const h = homes.find((x) => x.id === 'H-13')
    expect(markerStyle(h).fillColor).toBe(STATUS_COLOR.warning)
    expect(markerStyle({ ...h, online: false }).dashArray).toBeTruthy()
    expect(markerStyle(homes.find((x) => x.id === 'H-27')).weight).toBe(4)
  })
})
