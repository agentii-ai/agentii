import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import type { FileTreeNode } from '@/types/ide'

function flattenNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = []
  for (const node of nodes) {
    if (!node.isDirectory) result.push(node)
    if (node.children) result.push(...flattenNodes(node.children))
  }
  return result
}

export function SearchPanel() {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileTreeNode[]>([])
  const [loaded, setLoaded] = useState(false)
  const { readDirectory } = useFileSystem()
  const projectPath = useIDEStore((s) => s.projectPath)
  const openFile = useIDEStore((s) => s.openFile)

  if (!loaded && projectPath) {
    readDirectory(projectPath).then((nodes) => {
      setFiles(flattenNodes(nodes))
      setLoaded(true)
    })
  }

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return files.filter((f) => f.name.toLowerCase().includes(q))
  }, [query, files])

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {query.trim() && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No results found</p>
      )}
      {results.map((file) => (
        <button
          key={file.id}
          type="button"
          onClick={() => openFile(file.id)}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
        >
          <span className="truncate">{file.name}</span>
          <span className="ml-auto truncate text-[10px] text-muted-foreground">{file.id}</span>
        </button>
      ))}
    </div>
  )
}
