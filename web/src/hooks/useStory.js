import { useRef } from 'react'
import { STORY_STEPS, reachedNow } from '../lib/story'

// Progress only moves forward for a given house and run; a later step marks earlier ones done.
export function useStory(home, rank, events, runId) {
  const memo = useRef({ key: null, max: -1 })
  const key = `${runId}|${home ? home.id : ''}`
  if (memo.current.key !== key) memo.current = { key, max: -1 }
  const now = reachedNow(home, rank, events)
  STORY_STEPS.forEach((s, i) => {
    if (now.has(s.key) && i > memo.current.max) memo.current.max = i
  })
  const max = memo.current.max
  return STORY_STEPS.map((s, i) => ({
    ...s,
    state: i <= max ? 'done' : i === max + 1 ? 'current' : 'todo',
  }))
}
