import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, MessageSquare, Clock, MoreVertical, Pencil, Archive, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useProjects } from '@/hooks/useProjects'
import { useTerminalStore } from '@/stores/terminalStore'
import type { Project } from '@/types/project'

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const typeColors: Record<string, string> = {
  us_stock: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  us_stock_option: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  crypto: 'bg-green-500/15 text-green-700 dark:text-green-400',
  predictive_market: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { updateProject, archiveProject, deleteProject } = useProjects()
  const navigate = useNavigate()
  const activeTerminalProjectId = useTerminalStore((s) => s.projectId)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(project.name)

  // If the terminal already has this project active, navigate in same tab.
  // Otherwise open a new tab/window.
  const openProject = useCallback(() => {
    if (activeTerminalProjectId === project.id) {
      navigate(`/ide?project=${project.id}`)
    } else {
      window.open(`/ide?project=${project.id}`, '_blank')
    }
  }, [project.id, activeTerminalProjectId, navigate])

  const handleRename = useCallback(async () => {
    if (newName.trim() && newName !== project.name) {
      await updateProject(project.id, { name: newName.trim() })
    }
    setRenaming(false)
  }, [newName, project.id, project.name, updateProject])

  const handleDelete = useCallback(async () => {
    await deleteProject(project.id)
    setDeleteOpen(false)
  }, [project.id, deleteProject])

  return (
    <>
      <Card
        className="cursor-pointer transition-colors hover:border-primary/40 group"
        onClick={openProject}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openProject()
          }
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            {renaming ? (
              <input
                className="flex-1 rounded border border-input bg-background px-2 py-0.5 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <CardTitle className="text-sm">{project.name}</CardTitle>
            )}
            <div className="flex items-center gap-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[project.project_type] ?? 'bg-muted text-muted-foreground'}`}
              >
                {project.project_type}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => { setNewName(project.name); setRenaming(true) }}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => archiveProject(project.id)}>
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          {project.ticker_symbols.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.ticker_symbols.map((ticker) => (
                <Badge key={ticker} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {ticker}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground gap-3">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {project.file_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {project.session_count}
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {relativeTime(project.updated_at)}
          </span>
        </CardFooter>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.name}" and all its files and sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
