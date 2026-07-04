import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewportBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface LayoutState {
  sidebarWidth: number
  terminalPanelWidth: number
  terminalPanelVisible: boolean
  activePage: string

  // Responsive breakpoints (FR-002)
  sidebarCollapsed: boolean
  terminalDrawerOpen: boolean
  viewportBreakpoint: ViewportBreakpoint

  setPanelSize: (panel: 'sidebar' | 'terminal', size: number) => void
  toggleTerminalPanel: () => void
  setActivePage: (page: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setTerminalDrawerOpen: (open: boolean) => void
  setViewportBreakpoint: (bp: ViewportBreakpoint) => void
}

/** Compute breakpoint from viewport width */
export function widthToBreakpoint(width: number): ViewportBreakpoint {
  if (width < 900) return 'xs'
  if (width < 1200) return 'sm'
  if (width < 1600) return 'md'
  if (width < 1920) return 'lg'
  return 'xl'
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarWidth: 260,
      terminalPanelWidth: 360,
      terminalPanelVisible: true,
      activePage: 'dashboard',

      sidebarCollapsed: false,
      terminalDrawerOpen: false,
      viewportBreakpoint: 'md' as ViewportBreakpoint,

      setPanelSize: (panel, size) => {
        if (panel === 'sidebar') set({ sidebarWidth: size })
        else set({ terminalPanelWidth: size })
      },

      toggleTerminalPanel: () => set((state) => ({ terminalPanelVisible: !state.terminalPanelVisible })),

      setActivePage: (page) => set({ activePage: page }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setTerminalDrawerOpen: (open) => set({ terminalDrawerOpen: open }),

      setViewportBreakpoint: (bp) => set({ viewportBreakpoint: bp }),
    }),
    {
      name: 'agentii-layout-v2',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        terminalPanelWidth: state.terminalPanelWidth,
        terminalPanelVisible: state.terminalPanelVisible,
        activePage: state.activePage,
      }),
    },
  ),
)
