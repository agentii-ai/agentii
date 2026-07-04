import { useEffect, useRef } from 'react'
import { useLayoutStore } from '@/stores/layoutStore'
import { TerminalPanel } from './TerminalPanel'

/**
 * Slide-over drawer from right edge for terminal panel at narrow viewports (<1200px).
 * Contains the full TerminalPanel with tab bar, Channel 2 overlays, etc.
 * Dismisses on backdrop click or Escape.
 */
export function TerminalDrawer() {
  const open = useLayoutStore((s) => s.terminalDrawerOpen)
  const setOpen = useLayoutStore((s) => s.setTerminalDrawerOpen)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Escape to close
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Terminal panel">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="relative flex h-full w-[min(480px,90vw)] flex-col border-l border-border bg-background shadow-2xl"
      >
        <TerminalPanel />
      </div>
    </div>
  )
}
