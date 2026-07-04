import { useEffect, useState, useMemo } from 'react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useNavigate, useLocation } from 'react-router-dom'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import type { FileTreeNode } from '@/types/ide'

const pages = [
  { label: 'Dashboard', path: '/' },
  { label: 'Options Chain', path: '/options' },
  { label: 'Catalysts', path: '/catalysts' },
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Orders', path: '/orders' },
  { label: 'Trades', path: '/trades' },
  { label: 'Flow Builder', path: '/flow' },
  { label: 'Settings', path: '/settings' },
  { label: 'IDE', path: '/ide' },
]

function flattenFiles(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = []
  for (const node of nodes) {
    if (!node.isDirectory) result.push(node)
    if (node.children) result.push(...flattenFiles(node.children))
  }
  return result
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'navigate' | 'files'>('navigate')
  const [files, setFiles] = useState<FileTreeNode[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const { readDirectory } = useFileSystem()
  const projectPath = useIDEStore((s) => s.projectPath)
  const openFile = useIDEStore((s) => s.openFile)

  const isIDERoute = location.pathname.startsWith('/ide')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setMode('navigate')
        setOpen((prev) => !prev)
      }
      if (e.key === 'p' && (e.metaKey || e.ctrlKey) && isIDERoute) {
        e.preventDefault()
        setMode('files')
        setOpen(true)
        if (projectPath && files.length === 0) {
          readDirectory(projectPath).then((nodes) => setFiles(flattenFiles(nodes)))
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isIDERoute, projectPath, files.length, readDirectory])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={mode === 'files' ? 'Search project files...' : 'Search pages, symbols, actions...'} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {mode === 'navigate' && (
          <CommandGroup heading="Navigate">
            {pages.map((page) => (
              <CommandItem
                key={page.path}
                onSelect={() => {
                  navigate(page.path)
                  setOpen(false)
                }}
              >
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {mode === 'files' && (
          <CommandGroup heading="Project Files">
            {files.map((file) => (
              <CommandItem
                key={file.id}
                onSelect={() => {
                  openFile(file.id)
                  setOpen(false)
                }}
              >
                {file.name}
                <span className="ml-auto text-[10px] text-muted-foreground">{file.id}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
