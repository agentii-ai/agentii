import { useState } from 'react'
import { Cloud, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProjectStore } from '@/stores/projectStore'
import { useProjects } from '@/hooks/useProjects'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectTable } from '@/components/projects/ProjectTable'
import { ViewToggle } from '@/components/projects/ViewToggle'
import { ProjectCreateDialog } from '@/components/projects/ProjectCreateDialog'
import { FeaturedSection } from '@/components/projects/FeaturedSection'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/providers/AuthProvider'

export default function ProjectsDashboard() {
  const viewMode = useProjectStore((s) => s.viewMode)
  const setSearch = useProjectStore((s) => s.setSearch)
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const { projects, featuredProjects, isLoading } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)
  const { isDesktopOffline, session, signInWithOAuth } = useAuth()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const showSyncBanner = isDesktopOffline && !session && !bannerDismissed

  return (
    <div className="flex h-full flex-col">
      {/* Offline sync banner */}
      {showSyncBanner && (
        <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2.5">
          <Cloud className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            You are working offline. Sign in to sync your projects across devices.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => signInWithOAuth('github')}
            >
              Sign in
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Projects</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="h-8 w-56 pl-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ViewToggle />
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <FeaturedSection projects={featuredProjects} />

        {/* Main project list */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No projects match your search.' : 'No projects yet.'}
            </p>
            {!searchQuery && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create your first project
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <ProjectTable projects={projects} />
        )}
      </div>

      <ProjectCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
