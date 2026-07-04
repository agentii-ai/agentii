import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type VMStatus = 'stopped' | 'booting' | 'running' | 'suspended' | 'error'
export type McpHealth = 'healthy' | 'down' | 'restarted' | 'unknown'
export type PageContext = 'ide' | 'trading' | 'settings' | 'catalysts' | 'portfolio'

interface WorkspaceState {
  projectId: string | null
  isLocked: boolean
  vmStatus: VMStatus
  vmBootProgress: number
  vmError: string | null
  mcpHealth: Record<string, McpHealth>
  baseImageVersion: string
  currentPage: PageContext

  lockToProject: (projectId: string) => void
  setVMStatus: (status: VMStatus) => void
  setVMBootProgress: (progress: number) => void
  setVMError: (error: string | null) => void
  setMcpHealth: (health: Record<string, McpHealth>) => void
  setBaseImageVersion: (version: string) => void
  setCurrentPage: (page: PageContext) => void
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      projectId: null,
      isLocked: false,
      vmStatus: 'stopped',
      vmBootProgress: 0,
      vmError: null,
      mcpHealth: {},
      baseImageVersion: '',
      currentPage: 'ide',

      lockToProject: (projectId) => set({ projectId, isLocked: true }),
      setVMStatus: (vmStatus) => set({ vmStatus }),
      setVMBootProgress: (vmBootProgress) => set({ vmBootProgress }),
      setVMError: (vmError) => set({ vmError }),
      setMcpHealth: (mcpHealth) => set({ mcpHealth }),
      setBaseImageVersion: (baseImageVersion) => set({ baseImageVersion }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      reset: () =>
        set({
          projectId: null,
          isLocked: false,
          vmStatus: 'stopped',
          vmBootProgress: 0,
          vmError: null,
          mcpHealth: {},
          baseImageVersion: '',
          currentPage: 'ide',
        }),
    }),
    {
      name: 'agentii-workspace',
      partialize: (state) => ({
        projectId: state.projectId,
        isLocked: state.isLocked,
      }),
    },
  ),
)
