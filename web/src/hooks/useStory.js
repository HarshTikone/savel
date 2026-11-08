import { useRef } from 'react'
import { STORY_STEPS, reachedNow } from '../lib/story'

const SHOW_DONE_MS = 12000   // a finished story stays green this long, then clears for the next incident

// Signals that a NEW incident is under way (ignores results left over from the last one).
function liveSignals(home) {
  if (!home) return false
  return home.power_on === false || (!home.heating && home.trend === 'falling')
    || ['warning', 'critical'].includes(home.status) || ['ringing', 'in_call'].includes(home.call_status)
}

// Progress only moves forward during an incident; a later step marks earlier ones done.
// A new power cut restarts it, and a finished story clears itself after SHOW_DONE_MS.
export function useStory(home, rank, events, runId) {
  const memo = useRef({ key: null, max: -1, power: null, doneAt: null, cleared: false })
  const key = `${runId}|${home ? home.id : ''}`
  if (memo.current.key !== key) memo.current = { key, max: -1, power: null, doneAt: null, cleared: false }
  const m = memo.current
  const power = home ? home.power_on : null
  if (m.power === true && power === false) Object.assign(m, { max: -1, doneAt: null, cleared: false })
  m.power = power

  if (m.cleared) {
    if (!liveSignals(home)) return STORY_STEPS.map((s) => ({ ...s, state: 'todo' }))
    Object.assign(m, { cleared: false, max: -1, doneAt: null })
  }
  const now = reachedNow(home, rank, events)
  STORY_STEPS.forEach((s, i) => {
    if (now.has(s.key) && i > m.max) m.max = i
  })
  const last = STORY_STEPS.length - 1
  if (m.max === last) {
    if (m.doneAt === null) m.doneAt = Date.now()
    else if (Date.now() - m.doneAt > SHOW_DONE_MS) {
      Object.assign(m, { cleared: true, max: -1, doneAt: null })
      return STORY_STEPS.map((s) => ({ ...s, state: 'todo' }))
    }
  }
  return STORY_STEPS.map((s, i) => ({
    ...s,
    state: i <= m.max ? 'done' : i === m.max + 1 ? 'current' : 'todo',
  }))
}
