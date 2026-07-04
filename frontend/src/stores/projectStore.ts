import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, ViewMode } from '@/types/project'

interface ProjectStore {
  projects: Project[]
  featuredProjects: Project[]
  activeProjectId: string | null
  viewMode: ViewMode
  searchQuery: string

  setProjects: (projects: Project[]) => void
  setFeatured: (projects: Project[]) => void
  setActiveProject: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  setSearch: (query: string) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projects: [],
      featuredProjects: [],
      activeProjectId: null,
      viewMode: 'grid',
      searchQuery: '',

      setProjects: (projects) => set({ projects }),
      setFeatured: (projects) => set({ featuredProjects: projects }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearch: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'agentii-projects',
      partialize: (state) => ({
        viewMode: state.viewMode,
        activeProjectId: state.activeProjectId,
      }),
    },
  ),
)
