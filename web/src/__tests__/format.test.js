import { describe, it, expect } from 'vitest'
import { simClock, stormDuration, speedLabel } from '../lib/format'

describe('format', () => {
  it('stormDuration', () => {
    expect(stormDuration(1.0833)).toBe('1h 05m')
    expect(stormDuration(0)).toBe('now')
    expect(stormDuration(null)).toBe('—')
    expect(stormDuration(0.7)).toBe('42m')
  })
  it('simClock', () => expect(simClock('2026-11-08T02:20:00Z')).toBe('9:20 PM'))
  it('speedLabel', () => expect(speedLabel(300)).toBe('5 storm min/s'))
})
