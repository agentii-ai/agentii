import { useState, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TabBar } from './TabBar'
import { FileRenderer } from './FileRenderer'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useIDEStore } from '@/stores/ideStore'
import type { FileTab } from '@/types/ide'

interface EditorAreaProps {
  tabs: FileTab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
}

export function EditorArea({ tabs, activeTabId, onTabSelect, onTabClose }: EditorAreaProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const openFile = useIDEStore((s) => s.openFile)
  const { uploadFiles } = useFileUpload({ targetFolder: '/' })
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      const results = await uploadFiles(files)
      // Open the first successfully uploaded file
      const firstSuccess = results.find((r) => r.success)
      if (firstSuccess) {
        openFile(firstSuccess.filePath)
      }
    },
    [uploadFiles, openFile],
  )

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TabBar tabs={tabs} activeTabId={activeTabId} onTabSelect={onTabSelect} onTabClose={onTabClose} />
      <div className="flex-1 overflow-auto">
        {activeTab ? (
          <FileRenderer filePath={activeTab.filePath} viewMode={activeTab.viewMode} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Open a file from the file tree</p>
              <p className="mt-1 text-xs">⌘+P to quick open</p>
            </div>
          </div>
        )}
      </div>

      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8" />
            <p className="text-sm font-medium">Drop files to upload to workspace</p>
          </div>
        </div>
      )}
    </div>
  )
}
