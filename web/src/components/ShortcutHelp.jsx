import { useState } from 'react'

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  return (
    <span className="shortcut-help">
      <button type="button" className="btn" aria-expanded={open} aria-label="Keyboard shortcuts" onClick={() => setOpen((o) => !o)}>?</button>
      {open && (
        <ul className="shortcut-pop">
          <li><kbd>B</kbd> Toggle Block B power</li>
          <li><kbd>V</kbd> Toggle vent at H-27</li>
          <li><kbd>R</kbd> Reset (pre-warmed)</li>
          <li><kbd>D</kbd> Demo layout</li>
        </ul>
      )}
    </span>
  )
}
