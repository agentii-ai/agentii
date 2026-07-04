import { useState } from 'react'
import { ChevronDown, ChevronRight, Brain } from 'lucide-react'
import type { ReasoningMessage } from '@/types/agent'

interface ReasoningBlockProps {
  message: ReasoningMessage
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function ReasoningBlock({ message }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border-l-2 border-purple-500 bg-purple-500/5 pl-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 py-2 text-left text-sm"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Brain className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs text-purple-400">
          {message.phase === 'think' ? 'Thinking...' : 'Analyzing...'}
        </span>
      </button>
      {expanded && message.text && (
        <p className="pb-2 pr-3 text-xs italic text-muted-foreground whitespace-pre-wrap">
          {message.text}
        </p>
      )}
    </div>
  )
}
