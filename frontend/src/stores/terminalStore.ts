import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MAX_TERMINAL_TABS, type TerminalSessionType } from '@/types/terminal'
import type { CliReadinessState, PersistedTabLayout } from '@/types/cli-readiness'

export interface TerminalTab {
  id: string
  title: string
  cli: string
  type: TerminalSessionType
  status: 'idle' | 'connecting' | 'running' | 'exited'
  exitCode?: number
  /** T055: CLI readiness state for status indicator */
  readiness: CliReadinessState
  /** Error message when readiness is 'error' */
  readinessError?: string
  /** Names of env vars that were injected */
  injectedKeys: string[]
}

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  maxTabs: number
  /** The project ID these terminal tabs belong to */
  projectId: string | null

  // VM lifecycle
  vmStatus: 'unknown' | 'starting' | 'running' | 'error' | 'stopped'
  vmError: string | null

  // Tab actions
  addTab: (cli?: string, type?: TerminalSessionType) => string
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  renameTab: (id: string, title: string) => void
  setTabStatus: (id: string, status: TerminalTab['status'], exitCode?: number) => void

  // T055: CLI readiness actions
  setTabReadiness: (tabId: string, readiness: CliReadinessState, injectedKeys?: string[], errorMessage?: string) => void

  // T027: Tab layout persistence
  persistTabLayout: () => void
  loadPersistedLayout: (projectId: string) => PersistedTabLayout | null

  // Project-aware actions
  /** Switch terminal context to a project. Resets tabs if project changed. */
  switchProject: (projectId: string | null) => void

  // VM actions
  setVmStatus: (status: TerminalStore['vmStatus'], error?: string) => void
  resetVmError: () => void

  reset: () => void
}

let sessionCounter = 0

function nextTabId(): string {
  return `term-${Date.now()}-${++sessionCounter}`
}

/** Map CLI name to TerminalSessionType */
function cliToType(cli: string): TerminalSessionType {
  switch (cli) {
    case 'agentii': return 'agentii-cli'
    case 'claude': return 'claude'
    case 'goose': return 'goose'
    case 'opencode': return 'opencode'
    default: return 'shell'
  }
}

export const useTerminalStore = create<TerminalStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      maxTabs: MAX_TERMINAL_TABS,
      projectId: null,

      vmStatus: 'unknown',
      vmError: null,

      addTab: (cli = 'bash', type?: TerminalSessionType) => {
        const state = get()
        if (state.tabs.length >= state.maxTabs) return state.activeTabId ?? ''

        const id = nextTabId()
        const resolvedType = type ?? cliToType(cli)
        const tab: TerminalTab = {
          id,
          title: cli,
          cli,
          type: resolvedType,
          status: 'connecting',
          readiness: 'connecting',
          injectedKeys: [],
        }

        set({
          tabs: [...state.tabs, tab],
          activeTabId: id,
        })
        return id
      },

      removeTab: (id) => {
        const state = get()
        const idx = state.tabs.findIndex((t) => t.id === id)
        const newTabs = state.tabs.filter((t) => t.id !== id)

        let newActive = state.activeTabId
        if (state.activeTabId === id) {
          // Switch to adjacent tab
          if (newTabs.length > 0) {
            const nextIdx = Math.min(idx, newTabs.length - 1)
            newActive = newTabs[nextIdx].id
          } else {
            newActive = null
          }
        }

        set({ tabs: newTabs, activeTabId: newActive })
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      renameTab: (id, title) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
        })),

      setTabStatus: (id, status, exitCode) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === id ? { ...t, status, ...(exitCode !== undefined ? { exitCode } : {}) } : t,
          ),
        })),

      // T055: CLI readiness state update
      setTabReadiness: (tabId, readiness, injectedKeys, errorMessage) =>
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId
              ? { ...t, readiness, injectedKeys: injectedKeys ?? t.injectedKeys, readinessError: errorMessage }
              : t,
          ),
        })),

      // T027: Tab layout persistence
      persistTabLayout: () => {
        const state = get()
        if (!state.projectId) return
        const layout: PersistedTabLayout = {
          projectId: state.projectId,
          tabs: state.tabs.map((t, i) => ({
            cliId: t.cli,
            position: i,
            active: t.id === state.activeTabId,
          })),
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem(`agentii:tabs:${state.projectId}`, JSON.stringify(layout))
      },

      loadPersistedLayout: (projectId) => {
        const raw = localStorage.getItem(`agentii:tabs:${projectId}`)
        if (!raw) return null
        try {
          return JSON.parse(raw) as PersistedTabLayout
        } catch {
          return null
        }
      },

      setVmStatus: (vmStatus, error) =>
        set({ vmStatus, vmError: error ?? null }),

      resetVmError: () => set({ vmError: null }),

      switchProject: (projectId) => {
        const current = get().projectId
        if (projectId === current) return // Same project — keep existing tabs
        // Different project — reset terminal tabs so fresh PTYs are created
        set({ tabs: [], activeTabId: null, projectId, vmStatus: 'unknown', vmError: null })
      },

      reset: () => set({ tabs: [], activeTabId: null, projectId: null, vmStatus: 'unknown', vmError: null }),
    }),
    {
      name: 'agentii-terminal-v3',
      partialize: (state) => ({
        // Persist tab metadata only (not PTY state)
        tabs: state.tabs.map(({ id, title, cli, type }) => ({
          id,
          title,
          cli,
          type,
          status: 'idle' as const,
        })),
        activeTabId: state.activeTabId,
        projectId: state.projectId,
      }),
    },
  ),
)
