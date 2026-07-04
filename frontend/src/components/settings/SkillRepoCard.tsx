import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ChevronDown, ChevronRight, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { ConfigForm } from './ConfigForm'
import { STATUS_BADGE } from '@/lib/status-badge'
import type { SkillRepo } from '@/types/extension-registry'

interface SkillRepoCardProps {
  repo: SkillRepo
  onConfigure: (repoId: string, values: Record<string, string>) => void
  onToggle: (repoId: string, enabled: boolean) => void
  configuring?: boolean
}

export function SkillRepoCard({ repo, onConfigure, onToggle, configuring }: SkillRepoCardProps) {
  // Auto-expand cards that need setup so the config form is immediately visible
  const [expanded, setExpanded] = useState(repo.configStatus === 'needs_setup')

  const badge = STATUS_BADGE[repo.configStatus]

  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold truncate">{repo.name}</span>
              <span className="text-[10px] text-muted-foreground">by {repo.author}</span>
              {repo.repoUrl && (
                <a href={repo.repoUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" aria-label={`${repo.name} repository`}>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {repo.configStatus !== 'none' && (
                <Badge
                  variant={badge.variant}
                  className={`text-[10px] h-4 px-1.5 ${repo.configStatus === 'needs_setup' ? 'cursor-pointer' : ''}`}
                  onClick={repo.configStatus === 'needs_setup' ? () => setExpanded(true) : undefined}
                >
                  {repo.configStatus === 'configured' && <Check className="h-2.5 w-2.5 mr-0.5" />}
                  {repo.configStatus === 'needs_setup' && <AlertCircle className="h-2.5 w-2.5 mr-0.5" />}
                  {badge.label}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{repo.description}</p>
            {!expanded && (
              <span className="text-[10px] text-muted-foreground">{repo.skills.length} skill{repo.skills.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          <Switch
            checked={repo.enabled}
            onCheckedChange={(checked) => onToggle(repo.id, checked)}
            className="shrink-0"
            aria-label={`Toggle ${repo.name}`}
          />
        </div>

        {expanded && (
          <div className="mt-3 ml-7 space-y-3">
            {repo.skills.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Skills ({repo.skills.length})</span>
                <div className="mt-1 space-y-0.5">
                  {repo.skills.map((skill) => (
                    <div key={skill.id} className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="text-foreground">{skill.name}</span>
                      {skill.requiresConfig && repo.configStatus === 'needs_setup' && (
                        <AlertCircle className="h-2.5 w-2.5 text-amber-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {repo.configFields.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Configuration</span>
                <div className="mt-1">
                  <ConfigForm
                    key={repo.id}
                    fields={repo.configFields}
                    onSave={(values) => onConfigure(repo.id, values)}
                    saving={configuring}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
