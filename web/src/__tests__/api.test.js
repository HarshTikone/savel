import { describe, it, expect, vi, afterEach } from 'vitest'
import { request, ApiError } from '../services/api'

afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('throws ApiError with backend detail on 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'bad arg' }) }))
    await expect(request('/api/sim/x/y')).rejects.toMatchObject({ status: 400, detail: 'bad arg' })
  })
  it('throws network ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    const err = await request('/api/state').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
  })
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    await expect(request('/api/health')).resolves.toEqual({ ok: true })
  })
})
