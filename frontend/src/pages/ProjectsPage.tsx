import { FileTree } from '@/components/ide/FileTree'
import { EditorArea } from '@/components/ide/EditorArea'
import { useIDEStore } from '@/stores/ideStore'

export default function ProjectsPage() {
  const openTabs = useIDEStore((s) => s.openTabs)
  const activeTabId = useIDEStore((s) => s.activeTabId)
  const openFile = useIDEStore((s) => s.openFile)
  const closeTab = useIDEStore((s) => s.closeTab)
  const setActiveTab = useIDEStore((s) => s.setActiveTab)
  const projectPath = useIDEStore((s) => s.projectPath) ?? '/project'

  return (
    <div className="flex h-full">
      <div className="w-[220px] flex-shrink-0 border-r border-border overflow-auto">
        <div className="flex items-center border-b border-border px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Files</span>
        </div>
        <FileTree projectPath={projectPath} onFileOpen={openFile} />
      </div>
      <div className="flex-1 overflow-hidden">
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
