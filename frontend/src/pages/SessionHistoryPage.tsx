// T041 — Session History page
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, MessageSquare, Wrench, GitFork } from 'lucide-react'
import { useSessionHistoryStore } from '@/stores/sessionHistoryStore'
import { SessionExportButton } from '@/components/agent/SessionExportButton'
import type { AgentSession } from '@/types/session-history'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  completed: 'default',
  interrupted: 'secondary',
  error: 'destructive',
}

export default function SessionHistoryPage() {
  const { sessions, addSession } = useSessionHistoryStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleFork = (session: AgentSession) => {
    const forked: AgentSession = {
      ...session,
      id: crypto.randomUUID(),
      title: `Fork of: ${session.title}`,
      startedAt: new Date().toISOString(),
      endedAt: undefined,
      status: 'completed',
      durationMs: 0,
    }
    addSession(forked)
    setExpandedId(forked.id)
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-sm font-semibold mb-1">No sessions yet</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          Agent session history will appear here after you run conversations with the agent. Each session records messages, tool calls, and outcomes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-auto">
      <h1 className="text-lg font-semibold mb-4">Session History</h1>
      <div className="space-y-2 max-w-3xl">
        {sessions.map((session) => {
          const isExpanded = expandedId === session.id
          return (
            <Card key={session.id} className="transition-colors hover:border-primary/40">
              <CardContent className="p-0">
                <button className="w-full text-left p-4" onClick={() => setExpandedId(isExpanded ? null : session.id)} aria-expanded={isExpanded} aria-label={`Session: ${session.title}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium truncate">{session.title}</span>
                      <Badge variant={STATUS_VARIANT[session.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0 shrink-0">
                        {session.status}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {new Date(session.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(session.durationMs)}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{session.messageCount} messages</span>
                    <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{session.toolCallCount} tool calls</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    <div className="flex gap-2 py-3">
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleFork(session)}>
                        <GitFork className="h-3 w-3 mr-1" /> Fork
                      </Button>
                      <SessionExportButton session={session} />
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {session.messages.map((msg) => (
                        <div key={msg.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{msg.role}</Badge>
                            <span className="text-[10px] text-muted-foreground">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                          {msg.toolCalls?.map((tc, i) => (
                            <div key={i} className="ml-4 border-l-2 border-border pl-3 space-y-1">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-mono font-medium">{tc.toolName}</span>
                                <Badge variant={tc.success ? 'default' : 'destructive'} className="text-[9px] px-1 py-0">
                                  {tc.success ? 'ok' : 'err'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{tc.durationMs}ms</span>
                              </div>
                              <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto font-mono">{tc.input}</pre>
                              <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto font-mono">{tc.output}</pre>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
