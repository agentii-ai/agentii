import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FileTab, SidePanelView, PanelSizes } from '@/types/ide'
import type { StorageProvider } from '@/services/StorageProvider'
import { createStorageProvider } from '@/services/createStorageProvider'

interface IDEStore {
  projectPath: string | null
  activeProjectId: string | null
  projectTicker: string | null
  storageProvider: StorageProvider | null
  activeSidePanel: SidePanelView | null
  openTabs: FileTab[]
  activeTabId: string | null
  panelSizes: PanelSizes
  fileTreeExpanded: string[]

  setProjectPath: (path: string) => void
  setActiveProjectId: (id: string | null) => void
  setProjectTicker: (ticker: string | null) => void
  setSidePanel: (view: SidePanelView | null) => void
  openFile: (filePath: string, isPreview?: boolean) => void
  pinTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  updateTabDirty: (tabId: string, isDirty: boolean) => void
  updateTabCursor: (tabId: string, pos: number) => void
  updateTabScroll: (tabId: string, scrollTop: number) => void
  setPanelSizes: (sizes: Partial<PanelSizes>) => void
  toggleSidePanel: (view: SidePanelView) => void
  setFileTreeExpanded: (ids: string[]) => void
}

function fileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
      projectPath: null,
      activeProjectId: null,
      projectTicker: null,
      storageProvider: null,
      activeSidePanel: 'files',
      openTabs: [],
      activeTabId: null,
      panelSizes: { sidePanel: 20, editor: 55, agentPanel: 25 },
      fileTreeExpanded: [],

      setProjectPath: (path) => set({ projectPath: path }),

      setProjectTicker: (ticker) => set({ projectTicker: ticker }),

      setActiveProjectId: (id) => {
        const current = get().activeProjectId
        if (id === current) return // Same project — keep existing state
        if (id) {
          const provider = createStorageProvider(id)
          set({ activeProjectId: id, storageProvider: provider, openTabs: [], activeTabId: null })
        } else {
          set({ activeProjectId: null, storageProvider: null })
        }
      },

      setSidePanel: (view) => set({ activeSidePanel: view }),

      openFile: (filePath, isPreview = false) => {
        const { openTabs } = get()
        const existing = openTabs.find((t) => t.id === filePath)
        if (existing) {
          // If opening as non-preview (double-click), pin the tab
          if (!isPreview && existing.isPreview) {
            set({
              openTabs: openTabs.map((t) => t.id === filePath ? { ...t, isPreview: false } : t),
              activeTabId: filePath,
            })
          } else {
            set({ activeTabId: filePath })
          }
          return
        }

        const ext = filePath.split('.').pop() ?? ''
        const newTab: FileTab = {
          id: filePath,
          filePath,
          fileName: fileNameFromPath(filePath),
          isDirty: false,
          isPreview,
          cursorPos: 0,
          scrollTop: 0,
          viewMode: ext === 'md' ? 'preview' : 'source',
        }

        // If opening as preview, replace existing preview tab
        let newTabs: FileTab[]
        if (isPreview) {
          const previewIdx = openTabs.findIndex((t) => t.isPreview)
          if (previewIdx >= 0) {
            newTabs = [...openTabs]
            newTabs[previewIdx] = newTab
          } else {
            newTabs = [...openTabs, newTab]
          }
        } else {
          newTabs = [...openTabs, newTab]
        }

        set({ openTabs: newTabs, activeTabId: filePath })
      },

      pinTab: (tabId) => {
        set((state) => ({
          openTabs: state.openTabs.map((t) => t.id === tabId ? { ...t, isPreview: false } : t),
        }))
      },

      closeTab: (tabId) => {
        const { openTabs, activeTabId } = get()
        const idx = openTabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return
        const next = openTabs.filter((t) => t.id !== tabId)
        let nextActive = activeTabId
        if (activeTabId === tabId) {
          nextActive = next[Math.min(idx, next.length - 1)]?.id ?? null
        }
        set({ openTabs: next, activeTabId: nextActive })
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      reorderTabs: (fromIndex, toIndex) => {
        const tabs = [...get().openTabs]
        const [moved] = tabs.splice(fromIndex, 1)
        tabs.splice(toIndex, 0, moved)
        set({ openTabs: tabs })
      },

      updateTabDirty: (tabId, isDirty) =>
        set({ openTabs: get().openTabs.map((t) => (t.id === tabId ? { ...t, isDirty, ...(isDirty ? { isPreview: false } : {}) } : t)) }),

      updateTabCursor: (tabId, pos) =>
        set({ openTabs: get().openTabs.map((t) => (t.id === tabId ? { ...t, cursorPos: pos } : t)) }),

      updateTabScroll: (tabId, scrollTop) =>
        set({ openTabs: get().openTabs.map((t) => (t.id === tabId ? { ...t, scrollTop } : t)) }),

      setPanelSizes: (sizes) =>
        set({ panelSizes: { ...get().panelSizes, ...sizes } }),

      toggleSidePanel: (view) => {
        const current = get().activeSidePanel
        set({ activeSidePanel: current === view ? null : view })
      },

      setFileTreeExpanded: (ids) => set({ fileTreeExpanded: ids }),
    }),
    {
      name: 'agentii-ide',
      partialize: (state) => ({
        projectPath: state.projectPath,
        activeProjectId: state.activeProjectId,
        activeSidePanel: state.activeSidePanel,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        panelSizes: state.panelSizes,
        fileTreeExpanded: state.fileTreeExpanded,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.activeProjectId) {
          state.storageProvider = createStorageProvider(state.activeProjectId)
        }
      },
    },
  ),
)
