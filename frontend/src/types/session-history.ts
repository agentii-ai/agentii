// T006 — Session history types

export type SessionStatus = 'completed' | 'interrupted' | 'error'
export type MessageRole = 'user' | 'assistant' | 'system'

export interface ToolCall {
  toolName: string
  input: string
  output: string
  durationMs: number
  success: boolean
  timestamp: string
}

export interface ConversationMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
}

export interface AgentSession {
  id: string
  projectId?: string
  title: string
  startedAt: string
  endedAt?: string
  durationMs: number
  status: SessionStatus
  messageCount: number
  toolCallCount: number
  messages: ConversationMessage[]
}

export interface ToolUsageDayBucket {
  date: string
  toolName: string
  callCount: number
  successCount: number
  failureCount: number
  totalDurationMs: number
}
