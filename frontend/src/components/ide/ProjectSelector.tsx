import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronsUpDown, Search, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useProjectStore } from '@/stores/projectStore'
import type { Project } from '@/types/project'

interface ProjectSelectorProps {
  activeProjectId: string | null
  onSelect: (projectId: string) => void
  locked?: boolean
}

/** Minimal project info returned by the RPC function */
interface ProjectInfo {
  id: string
  name: string
  ticker_symbols: string[]
  project_type: string
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function ProjectSelector({ activeProjectId, onSelect, locked }: ProjectSelectorProps) {
  const projects = useProjectStore((s) => s.projects)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [lockedProject, setLockedProject] = useState<ProjectInfo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  // When locked and project not in store, fetch via RPC (bypasses RLS)
  useEffect(() => {
    if (!locked || !activeProjectId) {
      setLockedProject(null)
      return
    }
    if (activeProject) {
      setLockedProject(null)
      return
    }
    // Clear stale data immediately before fetching
    setLockedProject(null)
    let cancelled = false
    supabase
      .rpc('get_project_by_id', { project_id: activeProjectId })
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setLockedProject(data as ProjectInfo)
      })
    return () => { cancelled = true }
  }, [locked, activeProjectId, activeProject])

  const displayProject = activeProject ?? lockedProject

  const filtered = useMemo(() => projects.filter((p) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.ticker_symbols.some((t) => t.toLowerCase().includes(q))
    )
  }), [projects, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback((project: Project) => {
    onSelect(project.id)
    setOpen(false)
  }, [onSelect])

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  // --- All hooks above this line --- early return is safe below ---

  // When locked, render a static label — no dropdown
  if (locked && activeProjectId) {
    return (
      <div className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-sm">
        <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium">
          {displayProject?.name ?? 'Loading...'}
        </span>
        {displayProject && displayProject.ticker_symbols.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {displayProject.ticker_symbols[0]}
          </Badge>
        )}
      </div>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
          open && 'bg-accent',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">
          {activeProject ? activeProject.name : 'Select a project'}
        </span>
        {activeProject && activeProject.ticker_symbols.length > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {activeProject.ticker_symbols[0]}
          </Badge>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 w-full min-w-[240px] rounded-b-md border border-t-0 border-border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No projects found</div>
            ) : (
              filtered.map((project, idx) => (
                <button
                  key={project.id}
                  type="button"
                  role="option"
                  aria-selected={project.id === activeProjectId}
                  onClick={() => handleSelect(project)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                    idx === highlightIndex && 'bg-accent',
                    project.id === activeProjectId && 'font-medium',
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{project.name}</span>
                  {project.ticker_symbols.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {project.ticker_symbols[0]}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(project.updated_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
