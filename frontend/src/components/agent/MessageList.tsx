import { useRef, useEffect } from 'react'
import { UserMessage } from './UserMessage'
import { AgentMessage } from './AgentMessage'
import { ToolCallCard } from './ToolCallCard'
import { ReasoningBlock } from './ReasoningBlock'
import { ApprovalGate } from './ApprovalGate'
import { GenerativeUI } from './GenerativeUI'
import type { ChatMessage, ApprovalState } from '@/types/agent'

interface MessageListProps {
  messages: ChatMessage[]
  streamingText: string
  pendingApproval: ApprovalState | null
  onApprovalResolve: (requestId: string, decision: 'approved' | 'denied') => void
  onCitationClick?: (refId: string, rowNumber: number) => void
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function MessageList({ messages, streamingText, pendingApproval, onApprovalResolve }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrolled = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      userScrolled.current = scrollHeight - scrollTop - clientHeight > 100
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!userScrolled.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingText])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-3" role="log" aria-live="polite">
      {messages.map((msg) => {
        switch (msg.type) {
          case 'user':
            return <UserMessage key={msg.id} message={msg} />
          case 'agent':
            return <AgentMessage key={msg.id} message={msg} />
          case 'tool_call':
            return <ToolCallCard key={msg.id} message={msg} />
          case 'reasoning':
            return <ReasoningBlock key={msg.id} message={msg} />
          case 'generative_ui':
            return <GenerativeUI key={msg.id} component={msg.component} props={msg.props} />
          case 'error':
            return (
              <div key={msg.id} className="rounded border border-destructive/50 bg-destructive/5 p-2 text-xs text-destructive">
                {msg.message}
              </div>
            )
          case 'notice':
            return (
              <div key={msg.id} className="rounded bg-muted p-2 text-xs text-muted-foreground">
                {msg.title && <span className="font-medium">{msg.title}: </span>}
                {msg.message}
              </div>
            )
          default:
            return null
        }
      })}

      {streamingText && (
        <AgentMessage
          message={{ type: 'agent', id: 'streaming', text: '', citations: [], timestamp: Date.now() }}
          streamingText={streamingText}
        />
      )}

      {pendingApproval && (
        <ApprovalGate approval={pendingApproval} onResolve={onApprovalResolve} />
      )}

      <div ref={bottomRef} />
    </div>
  )
}
