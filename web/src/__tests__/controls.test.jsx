import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('../services/api', () => ({
  simAction: vi.fn(),
  simReset: vi.fn(),
}))

import { simAction } from '../services/api'
import state from '../data/mock/state.json'
import accuracy from '../data/mock/accuracy.json'
import SimulatorControls from '../components/SimulatorControls'
import AccuracyPanel, { accuracySentence } from '../components/AccuracyPanel'
import { useSimActions } from '../hooks/useSimActions'
import { useShortcuts } from '../hooks/useShortcuts'

function Harness() {
  const [vent, setVent] = useState(false)
  const actions = useSimActions({ state, ventBlocked: vent, setVentBlocked: setVent, refresh: async () => {} })
  return <SimulatorControls state={state} ventBlocked={vent} actions={actions} />
}

beforeEach(() => vi.clearAllMocks())

describe('SimulatorControls', () => {
  it('reflects backend block power (Block B is cut)', () => {
    simAction.mockResolvedValue({})
    render(<Harness />)
    expect(screen.getByRole('button', { name: /Block B/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Block A/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('sends restore_power for a cut block and disables the button while pending', async () => {
    let release
    simAction.mockImplementation(() => new Promise((res) => { release = res }))
    render(<Harness />)
    const btn = screen.getByRole('button', { name: /Block B/ })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    expect(simAction).toHaveBeenCalledWith('restore_power', 'B')
    await act(async () => { release({}) })
    await waitFor(() => expect(btn).not.toBeDisabled())
  })

  it('shows the backend detail on a 400', async () => {
    simAction.mockRejectedValue({ status: 400, detail: 'bad block' })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Block A/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('bad block')
  })

  it('flips the vent label only after success', async () => {
    simAction.mockResolvedValue({})
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Block vent at H-27/ }))
    expect(await screen.findByRole('button', { name: /Clear vent at H-27/ })).toBeInTheDocument()
  })
})

describe('AccuracyPanel', () => {
  it('shows the sentence when learned < global with n > 0', () => {
    render(<AccuracyPanel accuracy={accuracy} />)
    expect(screen.getByText(/cut 60-minute error from 1.8°F to 0.7°F/)).toBeInTheDocument()
  })
  it('makes no claim otherwise', () => {
    const worse = accuracy.map((r) => (r.k_source === 'learned' ? { ...r, mae_f: 3 } : r))
    expect(accuracySentence(worse)).toBeNull()
    const empty = accuracy.map((r) => ({ ...r, mae_f: null, n: 0 }))
    render(<AccuracyPanel accuracy={empty} />)
    expect(screen.getAllByText('Insufficient observations')).toHaveLength(4)
    expect(screen.queryByText(/Learning each home/)).toBeNull()
  })
})

describe('useShortcuts', () => {
  function Keys({ fn }) {
    useShortcuts({ b: fn })
    return <input aria-label="field" />
  }
  it('fires on B and is ignored while typing in an input', () => {
    const fn = vi.fn()
    render(<Keys fn={fn} />)
    fireEvent.keyDown(window, { key: 'b' })
    expect(fn).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'b' })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
