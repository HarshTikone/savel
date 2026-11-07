import { describe, it, expect } from 'vitest'
import homes from '../data/mock/homes.json'
import { HOME_KEYS, STATUSES, CALL_STATUSES, OUTCOMES, K_SOURCES } from '../data/contract'

describe('mock homes match contract', () => {
  it('has 40 homes', () => expect(homes).toHaveLength(40))

  it('has exactly the contract keys and valid enums', () => {
    for (const h of homes) {
      expect(Object.keys(h).sort()).toEqual([...HOME_KEYS].sort())
      expect(STATUSES).toContain(h.status)
      expect(CALL_STATUSES).toContain(h.call_status)
      expect(OUTCOMES).toContain(h.outcome)
      if (h.k_source !== null) expect(K_SOURCES).toContain(h.k_source)
    }
  })

  it('includes the demo homes', () => {
    const by = Object.fromEntries(homes.map((h) => [h.id, h]))
    expect(by['H-13'].status).toBe('warning')
    expect(by['H-16'].status).toBe('critical')
    expect(by['H-27'].co_ppm).toBe(62)
    expect(homes.some((h) => h.status === 'leaving')).toBe(true)
    expect(homes.some((h) => h.online === false)).toBe(true)
  })
})
