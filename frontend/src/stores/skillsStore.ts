// T014 — Skills store (registry-backed, thin cache layer)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectSkillOverrides } from '@/types/skill'

interface SkillsState {
  // Global enabled overrides (post-MVP: explicit toggle state)
  globalEnabled: Record<string, boolean>
  // Per-project overrides (post-MVP)
  projectOverrides: Record<string, ProjectSkillOverrides>
  toggleSkill: (repoId: string, enabled: boolean) => void
  setProjectOverride: (projectId: string, repoId: string, enabled: boolean) => void
  clearProjectOverride: (projectId: string, repoId: string) => void
}

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set) => ({
      globalEnabled: {},
      projectOverrides: {},

      toggleSkill: (repoId, enabled) =>
        set((s) => ({
          globalEnabled: { ...s.globalEnabled, [repoId]: enabled },
        })),

      setProjectOverride: (projectId, repoId, enabled) =>
        set((s) => ({
          projectOverrides: {
            ...s.projectOverrides,
            [projectId]: { ...s.projectOverrides[projectId], [repoId]: enabled },
          },
        })),

      clearProjectOverride: (projectId, repoId) =>
        set((s) => {
          const overrides = { ...s.projectOverrides[projectId] }
          delete overrides[repoId]
          return {
            projectOverrides: { ...s.projectOverrides, [projectId]: overrides },
          }
        }),
    }),
    { name: 'agentii-skills' }
  )
)
