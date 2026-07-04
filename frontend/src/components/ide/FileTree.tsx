import { useEffect, useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FileText, FileCode, Database, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import { useFileUpload } from '@/hooks/useFileUpload'
import type { StorageProvider } from '@/services/StorageProvider'
import type { FileTreeNode } from '@/types/ide'

interface FileTreeProps {
  projectPath: string
  onFileOpen: (filePath: string) => void
  onFileSendToAgent?: (filePath: string) => void
  pinnedFiles?: string[]
  storageProvider?: StorageProvider | null
}

function getFileIcon(extension: string | null, isDirectory: boolean) {
  if (isDirectory) return Folder
  switch (extension) {
    case 'md': return FileText
    case 'py': case 'js': case 'ts': case 'tsx': case 'jsx': case 'rs': case 'go': case 'sh': return FileCode
    case 'sql': return Database
    case 'json': return FileJson
    case 'csv': case 'xlsx': return FileSpreadsheet
    default: return File
  }
}

function getFileColor(extension: string | null, name: string): string {
  if (name === 'agentii.md') return 'text-blue-500'
  switch (extension) {
    case 'md': return 'text-gray-400'
    case 'py': return 'text-purple-500'
    case 'sql': return 'text-amber-500'
    case 'json': return 'text-yellow-500'
    case 'csv': case 'xlsx': return 'text-green-500'
    case 'pdf': return 'text-red-500'
    case 'rs': return 'text-orange-500'
    case 'toml': case 'yaml': case 'yml': return 'text-cyan-500'
    default: return 'text-muted-foreground'
  }
}

// --- Context Menu ---

interface ContextMenuState {
  x: number
  y: number
  node: FileTreeNode
}

function FileTreeContextMenu({ x, y, node, onClose, onFileOpen, onDelete, onRename, onNewFile, onNewFolder, onCopyPath, onUploadFiles }: {
  x: number; y: number; node: FileTreeNode; onClose: () => void
  onFileOpen: (path: string) => void; onDelete: (path: string) => void
  onRename: (node: FileTreeNode) => void; onNewFile: (parentPath: string) => void
  onNewFolder: (parentPath: string) => void; onCopyPath: (path: string) => void
  onUploadFiles: (targetFolder: string) => void
}) {
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [onClose])

  const parentPath = node.isDirectory ? node.id : node.id.split('/').slice(0, -1).join('/') || '/'

  const items = [
    { label: 'Open', action: () => onFileOpen(node.id), show: !node.isDirectory },
    { label: 'Rename', action: () => onRename(node), show: true, shortcut: 'F2' },
    { label: 'Delete', action: () => onDelete(node.id), show: true, shortcut: '⌘⌫' },
    { label: '—', action: () => {}, show: true },
    { label: 'New File', action: () => onNewFile(parentPath), show: true },
    { label: 'New Folder', action: () => onNewFolder(parentPath), show: true },
    { label: 'Upload Files...', action: () => onUploadFiles(parentPath), show: node.isDirectory },
    { label: '—', action: () => {}, show: true },
    { label: 'Copy Path', action: () => onCopyPath(node.id), show: true, shortcut: '⌘⇧C' },
  ]

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-md"
      style={{ left: x, top: y }}
    >
      {items.filter((i) => i.show).map((item, idx) =>
        item.label === '—' ? (
          <div key={`sep-${idx}`} className="my-1 border-t border-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={(e) => { e.stopPropagation(); item.action(); onClose() }}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent"
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="ml-4 text-[10px] text-muted-foreground">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  )
}

// --- Inline Create Input ---

function InlineCreateInput({ depth, onConfirm, onCancel }: {
  depth: number; onConfirm: (name: string) => void; onCancel: () => void
}) {
  const [value, setValue] = useState('')

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
      <File className="h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onConfirm(value.trim())
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel() }}
        className="flex-1 rounded border border-primary bg-background px-1 py-0.5 text-sm outline-none"
        autoFocus
        placeholder="filename"
      />
    </div>
  )
}

// --- Tree Node ---

function TreeNode({ node, depth, onFileOpen, expanded, onToggle, loadingDirs, onContextMenu, dropTargetId, onDragOverFolder, onDropOnFolder, onDragLeaveFolder }: {
  node: FileTreeNode; depth: number; onFileOpen: (path: string) => void
  expanded: Set<string>; onToggle: (id: string) => void; loadingDirs: Set<string>
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void
  dropTargetId: string | null
  onDragOverFolder: (e: React.DragEvent, folderId: string) => void
  onDropOnFolder: (e: React.DragEvent, folderId: string) => void
  onDragLeaveFolder: () => void
}) {
  const isExpanded = expanded.has(node.id)
  const isLoading = loadingDirs.has(node.id)
  const Icon = getFileIcon(node.extension, node.isDirectory)
  const color = getFileColor(node.extension, node.name)
  const isDropTarget = dropTargetId === node.id

  const handleClick = () => {
    if (node.isDirectory) onToggle(node.id)
    else onFileOpen(node.id)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node) }}
        onDragOver={node.isDirectory ? (e) => onDragOverFolder(e, node.id) : undefined}
        onDrop={node.isDirectory ? (e) => onDropOnFolder(e, node.id) : undefined}
        onDragLeave={node.isDirectory ? onDragLeaveFolder : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 px-2 py-1 text-sm hover:bg-accent transition-colors text-left',
          node.pinned && 'font-medium',
          isDropTarget && 'bg-primary/10 ring-1 ring-primary',
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.isDirectory && (
          <span className="flex-shrink-0">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
              isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
        <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
        <span className="truncate">{node.name}</span>
      </button>
      {node.isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onFileOpen={onFileOpen}
              expanded={expanded}
              onToggle={onToggle}
              loadingDirs={loadingDirs}
              onContextMenu={onContextMenu}
              dropTargetId={dropTargetId}
              onDragOverFolder={onDragOverFolder}
              onDropOnFolder={onDropOnFolder}
              onDragLeaveFolder={onDragLeaveFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Convert StorageProvider entries to FileTreeNode[] — shows ALL files including dotfiles */
function entriesToNodes(entries: import('@/services/StorageProvider').FileEntry[]): FileTreeNode[] {
  return entries
    .map((e) => {
      const ext = e.isDirectory ? null : (e.name.split('.').pop() ?? null)
      return {
        id: e.path,
        name: e.name,
        isDirectory: e.isDirectory,
        extension: ext,
        pinned: e.name === 'agentii.md',
        children: e.isDirectory ? undefined : undefined,
      } satisfies FileTreeNode
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
}

export function FileTree({ projectPath, onFileOpen, storageProvider }: FileTreeProps) {
  const { readDirectory, writeFile, deleteFile } = useFileSystem()
  const [nodes, setNodes] = useState<FileTreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [inlineCreate, setInlineCreate] = useState<{ parentPath: string; type: 'file' | 'folder'; depth: number } | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // File upload hook (target folder changes per drop)
  const [uploadTarget, setUploadTarget] = useState('/')
  const { uploadFiles } = useFileUpload({ targetFolder: uploadTarget })

  // Load root listing
  useEffect(() => {
    setLoading(true)
    setError(null)
    setNodes([])
    setExpanded(new Set())

    if (storageProvider) {
      storageProvider
        .list('/')
        .then((entries) => setNodes(entriesToNodes(entries)))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    } else if (projectPath) {
      readDirectory(projectPath)
        .then((tree) => {
          setNodes(tree)
          const rootDirs = tree.filter((n) => n.isDirectory).map((n) => n.id)
          setExpanded(new Set(rootDirs))
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [projectPath, readDirectory, storageProvider])

  const closeTab = useIDEStore((s) => s.closeTab)
  const openTabs = useIDEStore((s) => s.openTabs)

  // Poll for file changes every 3 seconds (silent refresh)
  useEffect(() => {
    if (!storageProvider) return

    const interval = setInterval(() => {
      storageProvider
        .list('/')
        .then((entries) => {
          const newNodes = entriesToNodes(entries)
          setNodes((prev) => {
            const prevNames = prev.map((n) => n.name).sort().join(',')
            const newNames = newNodes.map((n) => n.name).sort().join(',')
            if (prevNames === newNames) return prev

            const newPaths = new Set(newNodes.map((n) => n.id))
            for (const tab of openTabs) {
              if (!newPaths.has(tab.id) && !newPaths.has(tab.filePath)) {
                closeTab(tab.id)
              }
            }
            return newNodes
          })
        })
        .catch(() => {})
    }, 3000)

    return () => clearInterval(interval)
  }, [storageProvider, openTabs, closeTab])

  // Lazy-load directory children via StorageProvider
  const loadDirectoryChildren = useCallback(
    async (dirPath: string) => {
      if (!storageProvider) return
      setLoadingDirs((prev) => new Set(prev).add(dirPath))
      try {
        const entries = await storageProvider.list(dirPath)
        const children = entriesToNodes(entries)
        setNodes((prev) => insertChildren(prev, dirPath, children))
      } catch (err) {
        console.error('Failed to load directory:', dirPath, err)
      } finally {
        setLoadingDirs((prev) => { const next = new Set(prev); next.delete(dirPath); return next })
      }
    },
    [storageProvider],
  )

  const handleToggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
          if (storageProvider) {
            const node = findNode(nodes, id)
            if (node && node.isDirectory && !node.children) {
              loadDirectoryChildren(id)
            }
          }
        }
        return next
      })
    },
    [storageProvider, nodes, loadDirectoryChildren],
  )

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileTreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const handleDelete = useCallback(async (path: string) => {
    try {
      if (storageProvider) await storageProvider.delete(path)
      else await deleteFile(path)
      // Refresh will pick it up via polling
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }, [storageProvider, deleteFile])

  const handleRename = useCallback((_node: FileTreeNode) => {
    // Rename is handled via inline input — simplified for now
    // Full implementation would use an inline rename input on the node
  }, [])

  const handleNewFile = useCallback((parentPath: string) => {
    setInlineCreate({ parentPath, type: 'file', depth: 0 })
    // Ensure parent is expanded
    setExpanded((prev) => new Set(prev).add(parentPath))
  }, [])

  const handleNewFolder = useCallback((parentPath: string) => {
    setInlineCreate({ parentPath, type: 'folder', depth: 0 })
    setExpanded((prev) => new Set(prev).add(parentPath))
  }, [])

  const handleInlineConfirm = useCallback(async (name: string) => {
    if (!inlineCreate) return
    const { parentPath, type } = inlineCreate
    const fullPath = `${parentPath}/${name}`.replace(/\/+/g, '/')

    try {
      if (type === 'file') {
        if (storageProvider) await storageProvider.write(fullPath, '')
        else await writeFile(fullPath, '')
        onFileOpen(fullPath)
      } else {
        // Create folder by writing a placeholder and deleting it, or via mkdir
        if (storageProvider) await storageProvider.write(`${fullPath}/.keep`, '')
        else await writeFile(`${fullPath}/.keep`, '')
      }
    } catch (err) {
      console.error('Create failed:', err)
    }
    setInlineCreate(null)
  }, [inlineCreate, storageProvider, writeFile, onFileOpen])

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).catch(() => {})
  }, [])

  const handleUploadViaMenu = useCallback((targetFolder: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        setUploadTarget(targetFolder)
        // Small delay to let state update
        setTimeout(async () => {
          const files = Array.from(input.files!)
          await uploadFiles(files)
        }, 0)
      }
    }
    input.click()
  }, [uploadFiles])

  // Drop zone handlers for folders
  const handleDragOverFolder = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setDropTargetId(folderId)
    }
  }, [])

  const handleDropOnFolder = useCallback(async (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetId(null)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    setUploadTarget(folderId)
    setTimeout(async () => {
      await uploadFiles(files)
    }, 0)
  }, [uploadFiles])

  const handleDragLeaveFolder = useCallback(() => {
    setDropTargetId(null)
  }, [])

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading files...</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">Error: {error}</div>
  }

  if (nodes.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No files found</div>
  }

  return (
    <div className="py-1">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          onFileOpen={onFileOpen}
          expanded={expanded}
          onToggle={handleToggle}
          loadingDirs={loadingDirs}
          onContextMenu={handleContextMenu}
          dropTargetId={dropTargetId}
          onDragOverFolder={handleDragOverFolder}
          onDropOnFolder={handleDropOnFolder}
          onDragLeaveFolder={handleDragLeaveFolder}
        />
      ))}

      {/* Context menu */}
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onFileOpen={onFileOpen}
          onRename={handleRename}
          onDelete={handleDelete}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onCopyPath={handleCopyPath}
          onUploadFiles={handleUploadViaMenu}
        />
      )}

      {/* Inline create input */}
      {inlineCreate && (
        <InlineCreateInput
          depth={inlineCreate.depth}
          onConfirm={handleInlineConfirm}
          onCancel={() => setInlineCreate(null)}
        />
      )}
    </div>
  )
}

/** Recursively find a node by id */
function findNode(nodes: FileTreeNode[], id: string): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** Insert children into a node by path */
function insertChildren(nodes: FileTreeNode[], parentId: string, children: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) return { ...node, children }
    if (node.children) return { ...node, children: insertChildren(node.children, parentId, children) }
    return node
  })
}
