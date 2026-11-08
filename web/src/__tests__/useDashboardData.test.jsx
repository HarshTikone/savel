import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../services/api', () => ({
  getState: vi.fn(),
  getHomes: vi.fn(),
  getEvents: vi.fn(),
  getCurrentCall: vi.fn(),
  getAccuracy: vi.fn(),
  getCalls: vi.fn(() => Promise.resolve([])),
  getHealth: vi.fn(),
}))

import * as api from '../services/api'
import { useDashboardData } from '../hooks/useDashboardData'
import { POLL_MS } from '../config'

const state = (run_id) => ({ run_id, sim_now: '2026-11-08T02:20:00Z', outdoor_f: 12, speed: 300, live_call: false, blocks: [] })

function okAll(run_id = 'r1') {
  api.getState.mockResolvedValue(state(run_id))
  api.getHomes.mockResolvedValue([{ id: 'H-01' }])
  api.getEvents.mockResolvedValue([{ t: 'x', type: 'reset', home_id: null, text: 'e', severity: 'info' }])
  api.getCurrentCall.mockResolvedValue({ home_id: 'H-01' })
  api.getAccuracy.mockResolvedValue([{ horizon_min: 30, k_source: 'learned', mae_f: 1, n: 1 }])
  api.getHealth.mockResolvedValue({ ok: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('useDashboardData', () => {
  it('does not overlap requests when a fetch outlasts the interval', async () => {
    okAll()
    let release
    api.getState.mockImplementation(() => new Promise((res) => { release = () => res(state('r1')) }))
    renderHook(() => useDashboardData())
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 3) })
    expect(api.getState).toHaveBeenCalledTimes(1)
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(1) })
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS) })
    expect(api.getState.mock.calls.length).toBeGreaterThan(1)
  })

  it('goes stale after two failures but keeps previous homes', async () => {
    okAll()
    const { result } = renderHook(() => useDashboardData())
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(result.current.connection).toBe('live')
    for (const fn of [api.getState, api.getHomes, api.getEvents, api.getCurrentCall, api.getAccuracy, api.getCalls]) {
      fn.mockRejectedValue(new Error('x'))
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 2) })
    expect(result.current.connection).toBe('stale')
    expect(result.current.homes).toEqual([{ id: 'H-01' }])
  })

  it('clears events/call/accuracy and calls onRunChange once when run_id changes', async () => {
    okAll('r1')
    const onRunChange = vi.fn()
    const { result } = renderHook(() => useDashboardData({ onRunChange }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(result.current.events).toHaveLength(1)
    api.getState.mockResolvedValue(state('r2'))
    api.getEvents.mockRejectedValue(new Error('x'))
    api.getCurrentCall.mockRejectedValue(new Error('x'))
    api.getAccuracy.mockRejectedValue(new Error('x'))
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS) })
    expect(result.current.events).toEqual([])
    expect(result.current.call).toBeNull()
    expect(result.current.accuracy).toEqual([])
    expect(onRunChange).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS) })
    expect(onRunChange).toHaveBeenCalledTimes(1)
  })
})
