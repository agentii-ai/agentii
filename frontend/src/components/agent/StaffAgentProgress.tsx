interface StaffAgentProgressProps {
  agents: { name: string; status: 'running' | 'done' | 'error'; period?: string }[]
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function StaffAgentProgress({ agents }: StaffAgentProgressProps) {
  if (agents.length === 0) return null

  return (
    <div className="space-y-1.5">
      {agents.map((agent) => (
        <div key={agent.name} className="flex items-center gap-2 text-xs">
          <span className="flex-shrink-0">
            {agent.status === 'done' ? '✓' : agent.status === 'error' ? '✗' : '⟳'}
          </span>
          <span className="truncate">{agent.name}</span>
          {agent.period && <span className="text-muted-foreground">{agent.period}</span>}
          {agent.status === 'running' && (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
