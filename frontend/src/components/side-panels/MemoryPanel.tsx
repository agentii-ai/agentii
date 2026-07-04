import { useState, useEffect } from 'react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import { MarkdownViewer } from '@/components/ide/MarkdownViewer'

export function MemoryPanel() {
  const { readFile } = useFileSystem()
  const projectPath = useIDEStore((s) => s.projectPath)
  const openFile = useIDEStore((s) => s.openFile)
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) return
    readFile(`${projectPath}/agentii.md`)
      .then((r) => setContent(r.content))
      .catch(() => setContent(null))
  }, [projectPath, readFile])

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Memory</span>
        <button
          type="button"
          onClick={() => projectPath && openFile(`${projectPath}/agentii.md`)}
          className="text-[10px] text-blue-400 hover:underline"
        >
          Open agentii.md
        </button>
      </div>
      {content ? (
        <div className="text-xs">
          <MarkdownViewer content={content} viewMode="preview" />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No agentii.md found in project</p>
      )}
    </div>
  )
}
