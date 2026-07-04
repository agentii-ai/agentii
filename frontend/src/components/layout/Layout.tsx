import { useEffect, useRef, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { ActivityBar } from './ActivityBar'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { TerminalFloatingButton } from '@/components/terminal/TerminalFloatingButton'
import { TerminalDrawer } from '@/components/terminal/TerminalDrawer'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { useLayoutStore, widthToBreakpoint } from '@/stores/layoutStore'

/** Minimum terminal panel width in pixels (FR-002) */
const TERMINAL_MIN_WIDTH = 320
/** Maximum terminal panel width in pixels */
const TERMINAL_MAX_WIDTH = 1200

export function Layout() {
  const terminalPanelVisible = useLayoutStore((s) => s.terminalPanelVisible)
  const terminalPanelWidth = useLayoutStore((s) => s.terminalPanelWidth)
  const toggleTerminalPanel = useLayoutStore((s) => s.toggleTerminalPanel)
  const setPanelSize = useLayoutStore((s) => s.setPanelSize)
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const viewportBreakpoint = useLayoutStore((s) => s.viewportBreakpoint)
  const setSidebarCollapsed = useLayoutStore((s) => s.setSidebarCollapsed)
  const setViewportBreakpoint = useLayoutStore((s) => s.setViewportBreakpoint)
  const setTerminalDrawerOpen = useLayoutStore((s) => s.setTerminalDrawerOpen)

  const containerRef = useRef<HTMLDivElement>(null)
  const resizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Cmd+J to toggle terminal panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        const bp = useLayoutStore.getState().viewportBreakpoint
        if (bp === 'xs' || bp === 'sm') {
          // At narrow viewports, toggle the drawer instead
          const drawerOpen = useLayoutStore.getState().terminalDrawerOpen
          setTerminalDrawerOpen(!drawerOpen)
        } else {
          toggleTerminalPanel()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTerminalPanel, setTerminalDrawerOpen])

  // Responsive breakpoints (FR-002)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      const bp = widthToBreakpoint(width)
      const state = useLayoutStore.getState()

      // Update breakpoint
      if (bp !== state.viewportBreakpoint) {
        setViewportBreakpoint(bp)
      }

      // < 900px: collapse sidebar
      if (bp === 'xs' && !state.sidebarCollapsed) {
        setSidebarCollapsed(true)
      } else if (bp !== 'xs' && state.sidebarCollapsed) {
        setSidebarCollapsed(false)
      }

      // < 1200px: close drawer when transitioning back to inline
      if (bp !== 'xs' && bp !== 'sm' && state.terminalDrawerOpen) {
        setTerminalDrawerOpen(false)
      }

      // ≥ 1600px: scale terminal width (only auto-scale up, don't shrink user's manual resize)
      if (bp === 'lg' && state.terminalPanelVisible && state.terminalPanelWidth < 480) {
        setPanelSize('terminal', 480)
      } else if (bp === 'xl' && state.terminalPanelVisible && state.terminalPanelWidth < 600) {
        setPanelSize('terminal', 600)
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [setPanelSize, setSidebarCollapsed, setViewportBreakpoint, setTerminalDrawerOpen])

  // Whether terminal should render inline (≥1200px and visible)
  const showInlineTerminal = terminalPanelVisible && viewportBreakpoint !== 'xs' && viewportBreakpoint !== 'sm'
  // Whether to show floating button (narrow viewport, terminal not inline)
  const showFloatingButton = (viewportBreakpoint === 'xs' || viewportBreakpoint === 'sm') && !showInlineTerminal

  // Resize handle drag logic
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = terminalPanelWidth

    function handleMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const delta = startXRef.current - e.clientX
      const candidateWidth = startWidthRef.current + delta
      // Ensure the main area keeps at least 400px (activity bar ~48px)
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
      const activityBarWidth = 48
      const maxTerminal = containerWidth - activityBarWidth - 400
      const newWidth = Math.min(TERMINAL_MAX_WIDTH, Math.min(maxTerminal, Math.max(TERMINAL_MIN_WIDTH, candidateWidth)))
      setPanelSize('terminal', newWidth)
    }

    function handleMouseUp() {
      resizingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [terminalPanelWidth, setPanelSize])

  return (
    <div ref={containerRef} className="flex h-screen w-screen overflow-hidden bg-background">
      <ActivityBar
        terminalPanelVisible={terminalPanelVisible}
        onToggleTerminal={toggleTerminalPanel}
      />
      <main className="flex-1 h-full overflow-hidden" style={{ minWidth: 400 }}>
        <Outlet />
      </main>

      {showInlineTerminal && (
        <>
          {/* 4px resize handle between editor and terminal panel */}
          <div
            className="h-full w-1 flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary"
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize terminal panel"
          />
          <aside
            className="flex h-full flex-shrink-0 flex-col border-l border-border"
            style={{ width: `${terminalPanelWidth}px`, minWidth: `${TERMINAL_MIN_WIDTH}px` }}
          >
            <TerminalPanel />
          </aside>
        </>
      )}

      {/* Floating button at narrow viewports */}
      {showFloatingButton && <TerminalFloatingButton />}

      {/* Slide-over drawer at narrow viewports */}
      <TerminalDrawer />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}
