// T019 — MCP store (registry-backed, thin cache layer)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectMCPOverrides } from '@/types/mcp'

interface MCPState {
  // Per-project overrides (post-MVP)
  projectOverrides: Record<string, ProjectMCPOverrides>
  setProjectOverride: (projectId: string, serverId: string, enabled: boolean) => void
  clearProjectOverride: (projectId: string, serverId: string) => void
}

export const useMCPStore = create<MCPState>()(
  persist(
    (set) => ({
      projectOverrides: {},

      setProjectOverride: (projectId, serverId, enabled) =>
        set((s) => ({
          projectOverrides: {
            ...s.projectOverrides,
            [projectId]: { ...s.projectOverrides[projectId], [serverId]: enabled },
          },
        })),

      clearProjectOverride: (projectId, serverId) =>
        set((s) => {
          const overrides = { ...s.projectOverrides[projectId] }
          delete overrides[serverId]
          return {
            projectOverrides: { ...s.projectOverrides, [projectId]: overrides },
          }
        }),
    }),
    { name: 'agentii-mcp' }
  )
)
