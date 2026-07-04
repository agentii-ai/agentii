// T052 — Skill marketplace browse tab
import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Download } from 'lucide-react'
import { toast } from 'sonner'
import { SKILL_CATALOG } from '@/data/skill-catalog'
import { useSkillsStore } from '@/stores/skillsStore'
import type { SkillCategorySlug } from '@/types/skill'

const CATEGORIES: { value: SkillCategorySlug | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coding', label: 'Coding' },
  { value: 'data', label: 'Data' },
  { value: 'trading', label: 'Trading' },
  { value: 'research', label: 'Research' },
  { value: 'automation', label: 'Automation' },
  { value: 'devops', label: 'DevOps' },
  { value: 'writing', label: 'Writing' },
  { value: 'security', label: 'Security' },
]

export function SkillMarketplaceBrowse() {
  const { globalEnabled } = useSkillsStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<SkillCategorySlug | 'all'>('all')

  const installedIds = useMemo(() => new Set(Object.keys(globalEnabled)), [globalEnabled])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return SKILL_CATALOG.filter((s) => {
      if (category !== 'all' && s.category !== category) return false
      if (q && !s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, category])

  const handleInstall = (catalogSkill: (typeof SKILL_CATALOG)[number]) => {
    // Post-MVP: use backend GitHub install RPC
    toast.success(`${catalogSkill.name} installed`)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input placeholder="Search catalog..." value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-xs pl-8" />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            aria-pressed={category === cat.value}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${
              category === cat.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((skill) => {
          const isInstalled = installedIds.has(skill.id)
          return (
            <Card key={skill.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{skill.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{skill.category}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{skill.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{skill.author} · v{skill.version}</span>
                  {skill.installCount && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Download className="h-2.5 w-2.5" /> {skill.installCount}
                    </span>
                  )}
                </div>
                <Button
                  variant={isInstalled ? 'outline' : 'default'}
                  size="sm"
                  className="text-xs h-7 w-full"
                  disabled={isInstalled}
                  onClick={() => handleInstall(skill)}
                >
                  {isInstalled ? 'Installed' : 'Install'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No skills match your search.</p>
      )}
    </div>
  )
}
