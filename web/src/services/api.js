import { DATA_MODE } from '../config'
import stateFx from '../data/mock/state.json'
import homesFx from '../data/mock/homes.json'
import seriesFx from '../data/mock/series-H-13.json'
import eventsFx from '../data/mock/events.json'
import accuracyFx from '../data/mock/accuracy.json'
import callFx from '../data/mock/call.json'

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export async function request(path, opts = {}) {
  let res
  try {
    res = await fetch(path, opts)
  } catch {
    throw new ApiError(0, 'Network error')
  }
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`
    throw new ApiError(res.status, detail)
  }
  return body
}

const mock = (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 50))
const isMock = () => DATA_MODE === 'mock'

export const getHealth = () =>
  isMock()
    ? mock({ ok: true, sim_now: stateFx.sim_now, run_id: stateFx.run_id, rows_ingested: 0 })
    : request('/api/health')
export const getState = () => (isMock() ? mock(stateFx) : request('/api/state'))
export const getHomes = () => (isMock() ? mock(homesFx) : request('/api/homes'))
export const getSeries = (id) => {
  if (isMock()) {
    return id === 'H-13' ? mock(seriesFx) : Promise.reject(new ApiError(404, 'Unknown home'))
  }
  return request(`/api/homes/${encodeURIComponent(id)}/series`)
}
export const getEvents = () => (isMock() ? mock(eventsFx) : request('/api/events'))
export const getCurrentCall = () => (isMock() ? mock(callFx) : request('/api/calls/current'))
export const getAccuracy = () => (isMock() ? mock(accuracyFx) : request('/api/accuracy'))

export const simAction = (action, arg) =>
  isMock()
    ? mock({ ok: true })
    : request(`/api/sim/${action}/${encodeURIComponent(arg)}`, { method: 'POST' })

export const simReset = ({ prewarm } = {}) => {
  if (isMock()) return mock({ ok: true })
  const q = prewarm === undefined ? '' : `?prewarm=${prewarm}`
  return request(`/api/sim/reset${q}`, { method: 'POST' })
}

export const getTrends = () => (isMock() ? Promise.resolve({ window: 15, blocks: [], homes: {} }) : request('/api/trends'))

export const helpHome = (id) =>
  isMock() ? mock({ home_id: id, outcome: 'helped' }) : request(`/api/homes/${encodeURIComponent(id)}/help`, { method: 'POST' })
