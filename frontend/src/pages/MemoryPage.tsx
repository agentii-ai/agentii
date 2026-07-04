import { useState, useEffect } from 'react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import { MarkdownViewer } from '@/components/ide/MarkdownViewer'
import { useNavigate } from 'react-router-dom'

export default function MemoryPage() {
  const { readFile } = useFileSystem()
  const projectPath = useIDEStore((s) => s.projectPath) ?? '/project'
  const openFile = useIDEStore((s) => s.openFile)
  const navigate = useNavigate()
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    readFile(`${projectPath}/agentii.md`)
      .then((r) => setContent(r.content))
      .catch(() => setContent(null))
      .finally(() => setLoading(false))
  }, [projectPath, readFile])

  const handleOpenInEditor = () => {
    openFile(`${projectPath}/agentii.md`)
    navigate('/ide')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-sm font-medium">Agent Memory</h1>
        {content && (
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="text-xs text-blue-400 hover:underline"
          >
            Open in editor
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">Loading...</div>
        ) : content ? (
          <MarkdownViewer content={content} viewMode="preview" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <p>No agentii.md found in project</p>
            <p className="text-xs">Agent memory and context will appear here once a project is loaded.</p>
          </div>
        )}
      </div>
    </div>
  )
}
