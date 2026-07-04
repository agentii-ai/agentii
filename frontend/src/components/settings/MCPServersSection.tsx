// T017 — MCP Servers section (registry-backed)
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Server, ChevronDown, ChevronRight, Check, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useMcpList, useMcpConfigure, useMcpToggle } from '@/hooks/useExtensionConfig'
import { ConfigForm } from './ConfigForm'
import { STATUS_BADGE } from '@/lib/status-badge'
import type { McpServer } from '@/types/extension-registry'

const TRANSPORT_LABELS: Record<string, string> = {
  stdio: 'stdio',
  sse: 'SSE',
  'streamable-http': 'HTTP',
}

export function MCPServersSection() {
  const { data, isLoading, error } = useMcpList()
  const configureMutation = useMcpConfigure()
  const toggleMutation = useMcpToggle()
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  const servers = data?.servers ?? []

  // Auto-expand the first server that needs setup once data loads
  useEffect(() => {
    if (expandedServer === null && servers.length > 0) {
      const needsSetup = servers.find((s) => s.configStatus === 'needs_setup')
      if (needsSetup) setExpandedServer(needsSetup.id)
    }
  }, [servers])

  const handleConfigure = (serverId: string, values: Record<string, string>) => {
    configureMutation.mutate(
      { serverId, values },
      {
        onSuccess: (res) => {
          if (res.ok) toast.success('Configuration saved')
          else toast.error(res.message || 'Failed to save')
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleToggle = (serverId: string, enabled: boolean) => {
    toggleMutation.mutate(
      { serverId, enabled },
      {
        onSuccess: (res) => {
          if (res.warning) toast.warning(res.warning)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading MCP servers...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        Failed to load MCP servers: {error.message}
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Server className="h-8 w-8 mb-2" />
        <p className="text-xs">No MCP servers configured.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {servers.map((server) => {
        const isExpanded = expandedServer === server.id
        const badge = STATUS_BADGE[server.configStatus]

        return (
          <Card key={server.id} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setExpandedServer(isExpanded ? null : server.id)}
                  className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold truncate">{server.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {TRANSPORT_LABELS[server.transport] || server.transport}
                    </Badge>
                    {server.configStatus !== 'none' && (
                      <Badge variant={badge.variant} className="text-[10px] h-4 px-1.5">
                        {server.configStatus === 'configured' && <Check className="h-2.5 w-2.5 mr-0.5" />}
                        {server.configStatus === 'needs_setup' && <AlertCircle className="h-2.5 w-2.5 mr-0.5" />}
                        {badge.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{server.description}</p>
                  {!isExpanded && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {server.compatibility.map((cli) => (
                        <Badge key={cli} variant="secondary" className="text-[9px] h-3.5 px-1">
                          {cli}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => handleToggle(server.id, checked)}
                  className="shrink-0"
                  aria-label={`Toggle ${server.name}`}
                />
              </div>

              {isExpanded && (
                <div className="mt-3 ml-7 space-y-3">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Compatible CLI Agents</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {server.compatibility.map((cli) => (
                        <Badge key={cli} variant="secondary" className="text-[10px] h-4 px-1.5">
                          {cli}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {server.configFields.length > 0 && (
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Configuration</span>
                      <div className="mt-1">
                        <ConfigForm
                          key={server.id}
                          fields={server.configFields}
                          onSave={(values) => handleConfigure(server.id, values)}
                          saving={configureMutation.isPending && configureMutation.variables?.serverId === server.id}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
