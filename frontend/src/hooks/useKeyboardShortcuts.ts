import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  handler: () => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const metaMatch = s.meta ? e.metaKey : true
        const ctrlMatch = s.ctrl ? e.ctrlKey : true
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        if (e.key === s.key && metaMatch && ctrlMatch && shiftMatch) {
          e.preventDefault()
          s.handler()
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
