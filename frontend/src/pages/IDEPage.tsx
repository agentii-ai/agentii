import { lazy, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useIDEStore } from '@/stores/ideStore'
import { useProjectStore } from '@/stores/projectStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTerminalStore } from '@/stores/terminalStore'
import { useProjects } from '@/hooks/useProjects'
import { usePageContext } from '@/hooks/usePageContext'
import { useDuplicateTabGuard } from '@/hooks/useDuplicateTabGuard'

const IDEWindow = lazy(() => import('@/components/ide/IDEWindow').then((m) => ({ default: m.IDEWindow })))

export default function IDEPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const projectParam = searchParams.get('project')
  const activeProjectId = useIDEStore((s) => s.activeProjectId)
  const setActiveProjectId = useIDEStore((s) => s.setActiveProjectId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const projects = useProjectStore((s) => s.projects)
  const lockToProject = useWorkspaceStore((s) => s.lockToProject)
  const isLocked = useWorkspaceStore((s) => s.isLocked)
  const activeSidePanel = useIDEStore((s) => s.activeSidePanel)
  const setSidePanel = useIDEStore((s) => s.setSidePanel)
  const switchTerminalProject = useTerminalStore((s) => s.switchProject)

  // Ensure projects are loaded into the store
  useProjects()

  // Track page context for agent awareness
  usePageContext()

  // Detect duplicate tabs opening the same project — must complete before rendering IDE
  const { status: guardStatus } = useDuplicateTabGuard(projectParam)

  // Redirect to /projects if no project param (FR-020)
  useEffect(() => {
    if (!projectParam) {
      navigate('/projects', { replace: true })
    }
  }, [projectParam, navigate])

  // Sync stores to the URL project param — URL is the source of truth
  useEffect(() => {
    if (!projectParam) return
    // Always update when the URL project changes, even if already locked to a different project
    if (activeProjectId !== projectParam) {
      setActiveProjectId(projectParam)
      setActiveProject(projectParam)
    }
    if (!isLocked || useWorkspaceStore.getState().projectId !== projectParam) {
      lockToProject(projectParam)
    }
    // Sync terminal store — resets tabs only if project actually changed
    switchTerminalProject(projectParam)
  }, [projectParam, activeProjectId, isLocked, lockToProject, setActiveProjectId, setActiveProject, switchTerminalProject])

  // Ensure file tree is visible when IDE loads with a project
  useEffect(() => {
    if (projectParam && !activeSidePanel) {
      setSidePanel('files')
    }
  }, [projectParam, activeSidePanel, setSidePanel])

  // Set window title (T062)
  useEffect(() => {
    if (activeProjectId) {
      const project = projects.find((p) => p.id === activeProjectId)
      if (project) {
        const ticker = project.ticker_symbols.length > 0 ? ` (${project.ticker_symbols[0]})` : ''
        document.title = `${project.name}${ticker} — Agentii`
      }
    }
    return () => {
      document.title = 'Agentii'
    }
  }, [activeProjectId, projects])

  if (!projectParam) return null

  // Block rendering until duplicate tab check completes (~200ms).
  // This prevents the duplicate tab from creating WebSocket connections
  // and PTY sessions that would interfere with the existing tab.
  if (guardStatus === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading workspace…</div>
      </div>
    )
  }

  if (guardStatus === 'duplicate') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="text-muted-foreground text-sm">This project is already open in another tab.</div>
        <button
          className="text-primary hover:underline text-sm"
          onClick={() => navigate('/projects', { replace: true })}
        >
          ← Back to projects
        </button>
      </div>
    )
  }

  return (
    <IDEWindow
      projectPath={activeProjectId ? `/projects/${activeProjectId}` : undefined}
      windowId={activeProjectId ?? undefined}
      activeProjectId={activeProjectId}
      onProjectSelect={() => {}} // No-op: window is locked to project
    />
  )
}
