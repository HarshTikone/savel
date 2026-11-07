import { useEffect, useRef } from 'react'

const TYPING = ['INPUT', 'SELECT', 'TEXTAREA']

// handlers: { b, v, r, d } keyed by lowercase key. Ignored while typing in a form field.
export function useShortcuts(handlers) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t && (TYPING.includes(t.tagName) || t.isContentEditable)) return
      const fn = ref.current[e.key.toLowerCase()]
      if (fn) fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
