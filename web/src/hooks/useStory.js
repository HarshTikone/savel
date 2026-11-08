import { STORY_STEPS, reachedNow, callInProgress, isLeaving } from '../lib/story'

const SHOW_DONE_MS = 12000   // a finished story stays green this long, then clears for the next incident

// Kept outside React so switching pages or re-mounting never restarts or forgets a story.
const memos = new Map()      // `${runId}|${homeId}` -> { max, seen:Set, power, doneAt, cleared }

function callFailed(home) {
  return !!home && (home.call_result === 'unreachable' || home.outcome === 'unreachable' || ['unreachable', 'no_answer'].includes(home.call_status))
}

// Signals that a NEW incident is under way (ignores results left over from the last one).
function liveSignals(home) {
  if (!home) return false
  return home.power_on === false || (!home.heating && home.trend === 'falling')
    || ['warning', 'critical'].includes(home.status) || callInProgress(home)
}

function todo() {
  const steps = STORY_STEPS.map((s) => ({ ...s, state: 'todo' }))
  steps.cleared = true
  return steps
}

// Progress only moves forward during an incident; a later step marks earlier ones done.
// A new power cut restarts it, and a finished story clears itself SHOW_DONE_MS later.
// Step states: done (green), failed (red: call not answered), skipped (grey: passed without happening),
// current (in progress), todo.
export function useStory(home, rank, events, runId, now = Date.now()) {
  if (!home) return todo()
  const key = `${runId}|${home.id}`
  let m = memos.get(key)
  if (!m) {
    // First look at this house (e.g. after a reload): an incident that already ended starts cleared.
    const finished = (!liveSignals(home) && home.status === 'heated') || (isLeaving(home) && !callInProgress(home))
    m = { max: -1, seen: new Set(), power: null, doneAt: null, cleared: finished }
    memos.set(key, m)
  }
  const power = home.power_on
  if (m.power === true && power === false) Object.assign(m, { max: -1, seen: new Set(), doneAt: null, cleared: false })
  m.power = power

  if (m.cleared) {
    // A household that left stays cleared (its empty house keeps cooling) until the next power cut.
    if (!liveSignals(home) || isLeaving(home)) return todo()
    Object.assign(m, { cleared: false, max: -1, seen: new Set(), doneAt: null })
  }
  const reached = reachedNow(home, rank, events)
  STORY_STEPS.forEach((s, i) => {
    if (reached.has(s.key)) {
      m.seen.add(s.key)
      if (i > m.max) m.max = i
    }
  })
  const last = STORY_STEPS.length - 1
  const callIdx = STORY_STEPS.findIndex((s) => s.key === 'call')
  // Answered "leaving" ends the story at the call: help and back-to-normal are not needed.
  const left = isLeaving(home) && m.seen.has('call') && !callInProgress(home)
  if (m.max === last || left) {
    if (m.doneAt === null) m.doneAt = now
    else if (now - m.doneAt > SHOW_DONE_MS) {
      Object.assign(m, { cleared: true, max: -1, seen: new Set(), doneAt: null })
      return todo()
    }
  }
  const failed = callFailed(home)
  const steps = STORY_STEPS.map((s, i) => {
    let state = i <= m.max ? 'done' : i === m.max + 1 ? 'current' : 'todo'
    if (s.key === 'call') {
      if (state === 'done' && failed) state = 'failed'                         // red, but the story goes on
      else if (state === 'done' && !m.seen.has('call')) state = 'skipped'      // help came before any call result
      else if (state !== 'done' && callInProgress(home)) state = 'current'
    }
    if (left && i > callIdx && state !== 'done') state = 'skipped'
    if (left && i <= callIdx && state !== 'failed') state = state === 'skipped' ? 'skipped' : 'done'
    return { ...s, state }
  })
  steps.cleared = false
  return steps
}

export function _resetStoriesForTests() { memos.clear() }
