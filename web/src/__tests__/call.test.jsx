import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import callFx from '../data/mock/call.json'
import eventsFx from '../data/mock/events.json'
import CallPanel, { transcriptLine } from '../components/CallPanel'
import EventLog from '../components/EventLog'
import Banner from '../components/Banner'

describe('CallPanel', () => {
  it('shows No call in progress for null', () => {
    render(<CallPanel call={null} events={[]} />)
    expect(screen.getByText('No call in progress')).toBeInTheDocument()
  })
  it('shows SCRIPTED badge and extracted chips', () => {
    render(<CallPanel call={callFx} events={[]} />)
    expect(screen.getByText('SCRIPTED')).toBeInTheDocument()
    expect(screen.getByText('No heat')).toBeInTheDocument()
    expect(screen.getByText('Needs help')).toBeInTheDocument()
    expect(screen.getByText('oxygen concentrator')).toBeInTheDocument()
    expect(screen.getByText("Can't leave")).toBeInTheDocument()
  })
  it('shows LIVE TEST for a live call', () => {
    render(<CallPanel call={{ ...callFx, source: 'live' }} events={[]} />)
    expect(screen.getByText('LIVE TEST')).toBeInTheDocument()
  })
  it('normalizes transcript items', () => {
    expect(transcriptLine('hi')).toBe('hi')
    expect(transcriptLine({ role: 'agent', message: 'hello' })).toBe('agent: hello')
    expect(transcriptLine({ speaker: 'A', text: 'x' })).toBe('A: x')
    expect(transcriptLine({})).toBeNull()
  })
})

describe('EventLog', () => {
  it('selects the home on click and skips malformed events', () => {
    const onSelect = vi.fn()
    render(<EventLog events={[...eventsFx, null, { bad: true }]} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('H-27 carbon monoxide 62 ppm'))
    expect(onSelect).toHaveBeenCalledWith('H-27')
  })
})

describe('Banner', () => {
  it('shows once per new critical event and not for the initial batch', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Banner events={[]} ready={false} runId="r1" />)
    rerender(<Banner events={eventsFx} ready runId="r1" />)
    expect(screen.queryByText('H-27 carbon monoxide 62 ppm')).toBeNull()
    const fresh = { t: '2026-11-08T02:30:00Z', type: 'threshold', home_id: 'H-16', text: 'H-16 critical', severity: 'critical' }
    rerender(<Banner events={[fresh, ...eventsFx]} ready runId="r1" />)
    expect(screen.getByText('H-16 critical')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4100) })
    expect(screen.queryByText('H-16 critical')).toBeNull()
    rerender(<Banner events={[{ ...fresh }, ...eventsFx]} ready runId="r1" />)
    expect(screen.queryByText('H-16 critical')).toBeNull()
    vi.useRealTimers()
  })
})
