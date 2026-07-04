import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { useNavigate } from 'react-router-dom'
import type { FileTreeNode } from '@/types/ide'

function flattenNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = []
  for (const node of nodes) {
    if (!node.isDirectory) result.push(node)
    if (node.children) result.push(...flattenNodes(node.children))
  }
  return result
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<FileTreeNode[]>([])
  const [loaded, setLoaded] = useState(false)
  const { readDirectory } = useFileSystem()
  const projectPath = useIDEStore((s) => s.projectPath) ?? '/project'
  const openFile = useIDEStore((s) => s.openFile)
  const watchlists = useWatchlistStore((s) => s.watchlists)
  const navigate = useNavigate()

  if (!loaded) {
    readDirectory(projectPath).then((nodes) => {
      setFiles(flattenNodes(nodes))
      setLoaded(true)
    })
  }

  const watchlistSymbols = useMemo(() => {
    return watchlists.flatMap((w) => w.items.map((i) => ({ symbol: i.symbol, name: i.name, source: w.name })))
  }, [watchlists])

  const fileResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return files.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20)
  }, [query, files])

  const symbolResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return watchlistSymbols.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [query, watchlistSymbols])

  const handleFileClick = (filePath: string) => {
    openFile(filePath)
    navigate('/ide')
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, files, watchlists..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {!query.trim() && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Search across project files and watchlist symbols
          </p>
        )}

        {query.trim() && fileResults.length === 0 && symbolResults.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">No results for "{query}"</p>
        )}

        {fileResults.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Project Files</h3>
            <div className="space-y-1">
              {fileResults.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleFileClick(file.id)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <span className="font-medium">{file.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">{file.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {symbolResults.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Watchlist Symbols</h3>
            <div className="space-y-1">
              {symbolResults.map((s) => (
                <div
                  key={s.symbol}
                  className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <span className="font-bold">{s.symbol}</span>
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.source}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
