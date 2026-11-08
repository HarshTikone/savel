import { Check, X, Minus } from 'lucide-react'
import { stepDetail } from '../lib/story'

export default function HouseStory({ steps, home, rank, vertical = false }) {
  if (!home) return null
  return (
    <ol className={`story${vertical ? ' vertical' : ''}`} aria-label={`Story for ${home.id}`}>
      {steps.map((s, i) => (
        <li key={s.key} className={`story-step ${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className="story-dot">{s.state === 'done' ? <Check size={14} strokeWidth={3} /> : s.state === 'failed' ? <X size={14} strokeWidth={3} /> : s.state === 'skipped' ? <Minus size={14} strokeWidth={3} /> : i + 1}</span>
          <span className="story-text">
            <span className="story-label">{s.label}</span>
            <span className="story-detail">{steps.cleared ? '' : s.state === 'skipped' ? 'No call result' : (s.state === 'current' && s.key !== 'call') || s.state === 'todo' ? '' : stepDetail(s.key, home, rank)}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
