import { Terminal } from 'lucide-react'
import { useTerminalStore } from '@/stores/terminalStore'
import { useLayoutStore } from '@/stores/layoutStore'

/**
 * Fixed bottom-right floating button showing active terminal tab count.
 * Visible when viewport < 1200px and terminal panel is not inline.
 * Clicking opens the slide-over TerminalDrawer.
 */
export function TerminalFloatingButton() {
  const tabCount = useTerminalStore((s) => s.tabs.length)
  const setTerminalDrawerOpen = useLayoutStore((s) => s.setTerminalDrawerOpen)

  return (
    <button
      type="button"
      onClick={() => setTerminalDrawerOpen(true)}
      className="glow-primary fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      aria-label={`Open terminal panel (${tabCount} tab${tabCount !== 1 ? 's' : ''})`}
    >
      <Terminal className="h-5 w-5" />
      {tabCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {tabCount}
        </span>
      )}
    </button>
  )
}
