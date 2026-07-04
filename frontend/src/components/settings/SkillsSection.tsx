// T013 — Skills section with three-tier hierarchy: Category → Repo → Skills
import { useState, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronDown, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSkillsList, useSkillsConfigure, useSkillsToggle } from '@/hooks/useExtensionConfig'
import { SkillRepoCard } from './SkillRepoCard'
import type { SkillCategory } from '@/types/extension-registry'

export function SkillsSection() {
  const { data, isLoading, error } = useSkillsList()
  const configureMutation = useSkillsConfigure()
  const toggleMutation = useSkillsToggle()
  const [query, setQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const categories = data?.categories ?? []

  // Filter categories/repos/skills by search query
  const filtered = useMemo(() => {
    if (!query.trim()) return categories
    const q = query.toLowerCase()
    return categories
      .map((cat) => ({
        ...cat,
        repos: cat.repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(q) ||
            repo.description.toLowerCase().includes(q) ||
            repo.skills.some((s) => s.name.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.repos.length > 0)
  }, [categories, query])

  // Auto-expand categories with search matches
  const effectiveExpanded = useMemo(() => {
    if (query.trim()) {
      return new Set(filtered.map((c) => c.id))
    }
    return expandedCategories
  }, [filtered, expandedCategories, query])

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  const handleConfigure = (repoId: string, values: Record<string, string>) => {
    configureMutation.mutate(
      { repoId, values },
      {
        onSuccess: (res) => {
          if (res.ok) {
            toast.success('Configuration saved')
          } else {
            toast.error(res.message || 'Failed to save')
          }
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleToggle = (repoId: string, enabled: boolean) => {
    toggleMutation.mutate(
      { repoId, enabled },
      {
        onSuccess: (res) => {
          if (res.warning) toast.warning(res.warning)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  // C20: Memoize category stats to avoid recomputation on every render
  const categoryStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; configured: number; needsSetup: number }>()
    for (const cat of filtered) {
      const total = cat.repos.length
      const configured = cat.repos.filter((r) => r.configStatus === 'configured' || r.configStatus === 'none').length
      const needsSetup = cat.repos.filter((r) => r.configStatus === 'needs_setup').length
      map.set(cat.id, { total, configured, needsSetup })
    }
    return map
  }, [filtered])

  const categoryStats = useCallback((catId: string) => {
    return categoryStatsMap.get(catId) ?? { total: 0, configured: 0, needsSetup: 0 }
  }, [categoryStatsMap])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading skills...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load skills: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 h-8 text-xs"
          aria-label="Search skills"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No skills match your search.</p>
      )}

      {filtered.map((cat) => {
        const stats = categoryStats(cat.id)
        const isExpanded = effectiveExpanded.has(cat.id)

        return (
          <div key={cat.id} className="space-y-2">
            <button
              onClick={() => toggleCategory(cat.id)}
              className="flex items-center gap-2 w-full text-left group"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold">{cat.label}</span>
              <span className="text-[10px] text-muted-foreground">
                {cat.repos.reduce((sum, r) => sum + r.skills.length, 0)} skills in {cat.repos.length} package{cat.repos.length !== 1 ? 's' : ''}
              </span>
              {stats.needsSetup > 0 && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 ml-auto">
                  <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                  {stats.needsSetup} need setup
                </Badge>
              )}
              {stats.needsSetup === 0 && stats.configured === stats.total && (
                <Badge variant="default" className="text-[10px] h-4 px-1.5 ml-auto">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  All configured
                </Badge>
              )}
            </button>

            {isExpanded && (
              <div className="ml-6 space-y-2">
                {cat.repos.map((repo) => (
                  <SkillRepoCard
                    key={repo.id}
                    repo={repo}
                    onConfigure={handleConfigure}
                    onToggle={handleToggle}
                    configuring={configureMutation.isPending && configureMutation.variables?.repoId === repo.id}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
