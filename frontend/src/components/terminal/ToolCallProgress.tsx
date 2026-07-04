import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useAgentOverlayStore } from '@/stores/agentOverlayStore'

/**
 * Status bar indicator showing active tool name + spinner.
 * Consumes Channel 2 TOOL_CALL_START/END events via agentOverlayStore.
 * Only visible for agentii tabs when a tool call is in progress.
 */
export function ToolCallProgress() {
  const activeToolCall = useAgentOverlayStore((s) => s.activeToolCall)
  const [elapsed, setElapsed] = useState(0)

  // Elapsed timer
  useEffect(() => {
    if (!activeToolCall) {
      setElapsed(0)
      return
    }

    const start = Date.now()
    setElapsed(0)

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [activeToolCall])

  if (!activeToolCall) return null

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span className="max-w-[140px] truncate font-mono">{activeToolCall.toolName}</span>
      {elapsed > 0 && (
        <span className="tabular-nums">{elapsed}s</span>
      )}
    </div>
  )
}
