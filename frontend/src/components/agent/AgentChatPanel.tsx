import { useEffect, useRef } from 'react'
import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AgentHeader } from './AgentHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useAgentEvent } from '@/hooks/useAgentEvent'
import { useAgentSessions } from '@/hooks/useAgentSessions'
import { useAgentStore } from '@/stores/agentStore'
import { useProviderKeys } from '@/hooks/useProviderKeys'
import { useWebSocketStore } from '@/stores/webSocketStore'
import { Button } from '@/components/ui/button'

interface AgentChatPanelProps {
  onCollapse: () => void
  onCitationClick?: (refId: string, rowNumber: number) => void
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function AgentChatPanel({ onCollapse, onCitationClick }: AgentChatPanelProps) {
  useAgentEvent()
  const { sendMessage, abortGeneration, resolveApproval, loadHistory, isStreaming, messages } = useAgentChat()
  const { sessions, switchSession, createSession } = useAgentSessions()
  const { keys, loading: keysLoading } = useProviderKeys()
  const navigate = useNavigate()

  const sessionId = useAgentStore((s) => s.sessionId)
  const streamingText = useAgentStore((s) => s.streamingText)
  const pendingApproval = useAgentStore((s) => s.pendingApproval)
  const { input: inputTokens, output: outputTokens } = useAgentStore((s) => s.sessionTokens)
  const estimatedCost = useAgentStore((s) => s.estimatedCostUsd)
  const wsStatus = useWebSocketStore((s) => s.status)

  // Load chat history when session changes and WS is connected
  const prevSessionRef = useRef<string | null>(null)
  useEffect(() => {
    if (wsStatus === 'connected' && sessionId && sessionId !== 'main' && sessionId !== prevSessionRef.current) {
      prevSessionRef.current = sessionId
      loadHistory()
    }
  }, [wsStatus, sessionId, loadHistory])

  const hasProvider = !keysLoading && keys.length > 0

  return (
    <div className="flex h-full flex-col bg-card">
      <AgentHeader
        sessions={sessions}
        activeSessionKey={sessionId}
        inputTokens={inputTokens}
        outputTokens={outputTokens}
        estimatedCost={estimatedCost}
        onSessionSwitch={switchSession}
        onSessionCreate={createSession}
        onCollapse={onCollapse}
      />
      {!hasProvider && messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Configure an LLM provider to start chatting with the agent.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings')}
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Open Settings
          </Button>
        </div>
      ) : (
        <MessageList
          messages={messages}
          streamingText={streamingText}
          pendingApproval={pendingApproval}
          onApprovalResolve={resolveApproval}
          onCitationClick={onCitationClick}
        />
      )}
      <ChatInput
        onSend={(text) => sendMessage(text)}
        onAbort={abortGeneration}
        isStreaming={isStreaming}
      />
    </div>
  )
}
