import { useEffect, useCallback, useRef } from 'react'
import { SidePanel } from '@/components/layout/SidePanel'
import { ProjectSelector } from './ProjectSelector'
import { FileTree } from './FileTree'
import { EditorArea } from './EditorArea'
import { SearchPanel } from '@/components/side-panels/SearchPanel'
import { MemoryPanel } from '@/components/side-panels/MemoryPanel'
import { CatalystsPanel } from '@/components/side-panels/CatalystsPanel'
import { SettingsPanel } from '@/components/side-panels/SettingsPanel'
import { InstructionsPanel } from '@/components/side-panels/InstructionsPanel'
import { useIDEStore } from '@/stores/ideStore'
import { useLayoutStore } from '@/stores/layoutStore'

interface IDEWindowProps {
  projectPath?: string
  windowId?: string
  activeProjectId?: string | null
  onProjectSelect?: (projectId: string) => void
}

const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 500

export function IDEWindow({ projectPath: initialPath, activeProjectId, onProjectSelect }: IDEWindowProps) {
  const activeSidePanel = useIDEStore((s) => s.activeSidePanel)
  const setSidePanel = useIDEStore((s) => s.setSidePanel)
  const openTabs = useIDEStore((s) => s.openTabs)
  const activeTabId = useIDEStore((s) => s.activeTabId)
  const openFile = useIDEStore((s) => s.openFile)
  const closeTab = useIDEStore((s) => s.closeTab)
  const setActiveTab = useIDEStore((s) => s.setActiveTab)
  const setProjectPath = useIDEStore((s) => s.setProjectPath)
  const projectPath = useIDEStore((s) => s.projectPath)
  const containerRef = useRef<HTMLDivElement>(null)

  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const setPanelSize = useLayoutStore((s) => s.setPanelSize)

  // Sidebar resize state
  const resizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  useEffect(() => {
    if (initialPath) setProjectPath(initialPath)
    else if (!projectPath) setProjectPath('/project')
  }, [initialPath, projectPath, setProjectPath])

  // Default to files panel if none active
  useEffect(() => {
    if (!activeSidePanel) {
      setSidePanel('files')
    }
  }, [activeSidePanel, setSidePanel])

  const handleFileOpen = useCallback((filePath: string) => {
    openFile(filePath)
  }, [openFile])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) closeTab(activeTabId)
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        if (openTabs[idx]) setActiveTab(openTabs[idx].id)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSidePanel('search')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTabId, closeTab, openTabs, setActiveTab, setSidePanel])

  const effectivePath = projectPath ?? '/project'
  const storageProvider = useIDEStore((s) => s.storageProvider)

  const handleProjectSelect = useCallback((projectId: string) => {
    onProjectSelect?.(projectId)
  }, [onProjectSelect])

  // Pixel-based sidebar resize (same pattern as terminal panel in Layout.tsx)
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth

    function handleMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const delta = e.clientX - startXRef.current
      const newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, startWidthRef.current + delta))
      setPanelSize('sidebar', newWidth)
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
  }, [sidebarWidth, setPanelSize])

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Side panel — fixed pixel width, never collapses below SIDEBAR_MIN_WIDTH */}
      {activeSidePanel && (
        <>
          <div
            className="h-full flex-shrink-0 overflow-hidden"
            style={{ width: sidebarWidth }}
          >
            <SidePanel activeView={activeSidePanel}>
              {{
                files: (
                  <div className="flex h-full flex-col">
                    <ProjectSelector activeProjectId={activeProjectId ?? null} onSelect={handleProjectSelect} locked={!!activeProjectId} />
                    {activeProjectId ? (
                      <FileTree projectPath={effectivePath} onFileOpen={handleFileOpen} storageProvider={storageProvider} />
                    ) : (
                      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
                        Select a project to get started
                      </div>
                    )}
                  </div>
                ),
                watchlist: <div className="p-4 text-sm text-muted-foreground">Watchlist</div>,
                search: <SearchPanel />,
                memory: <MemoryPanel />,
                catalysts: <CatalystsPanel />,
                settings: <SettingsPanel />,
                instructions: <InstructionsPanel />,
              }}
            </SidePanel>
          </div>
          {/* Resize handle */}
          <div
            className="h-full w-1 flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary"
            onMouseDown={handleSidebarResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize file panel"
          />
        </>
      )}

      {/* Editor area — takes remaining space */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <EditorArea
          tabs={openTabs}
          activeTabId={activeTabId}
          onTabSelect={setActiveTab}
          onTabClose={closeTab}
        />
      </div>
    </div>
  )
}
