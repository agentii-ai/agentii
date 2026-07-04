import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentTextMessage } from '@/types/agent'

interface AgentMessageProps {
  message: AgentTextMessage
  streamingText?: string
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function AgentMessage({ message, streamingText }: AgentMessageProps) {
  const text = streamingText ?? message.text

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] text-sm">
        <div className="prose prose-sm prose-invert max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </div>
        {streamingText != null && (
          <span className="inline-block h-4 w-1 animate-pulse bg-foreground" />
        )}
        {message.durationMs != null && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {(message.durationMs / 1000).toFixed(1)}s
            {message.model && ` · ${message.model}`}
          </p>
        )}
      </div>
    </div>
  )
}
