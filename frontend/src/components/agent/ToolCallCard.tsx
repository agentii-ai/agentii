import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Check, X } from 'lucide-react'
import type { ToolCallMessage } from '@/types/agent'

interface ToolCallCardProps {
  message: ToolCallMessage
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function ToolCallCard({ message }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = message.status === 'running'
    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
    : message.status === 'success'
      ? <Check className="h-3.5 w-3.5 text-green-400" />
      : <X className="h-3.5 w-3.5 text-red-400" />

  return (
    <div className="rounded border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {statusIcon}
        <span className="font-mono text-xs">{message.toolName}</span>
        {message.durationMs != null && (
          <span className="ml-auto text-[10px] text-muted-foreground">{message.durationMs}ms</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 text-xs">
          <p className="mb-1 font-medium text-muted-foreground">Input:</p>
          <pre className="overflow-x-auto rounded bg-background p-2 font-mono">
            {JSON.stringify(message.input, null, 2)}
          </pre>
          {message.output && (
            <>
              <p className="mb-1 mt-2 font-medium text-muted-foreground">Output:</p>
              <pre className="overflow-x-auto rounded bg-background p-2 font-mono whitespace-pre-wrap">
                {message.output}
              </pre>
            </>
          )}
          {message.error && (
            <p className="mt-2 text-red-400">{message.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
