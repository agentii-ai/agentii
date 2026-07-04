/** Agent event and chat message types (spec 004) */

// --- Chat message types (Zustand store shape) ---

export interface UserMessage {
  type: 'user'
  id: string
  text: string
  attachments: FileAttachment[]
  timestamp: number
}

export interface AgentTextMessage {
  type: 'agent'
  id: string
  text: string
  citations: Citation[]
  model?: string
  provider?: string
  durationMs?: number
  timestamp: number
}

export interface ToolCallMessage {
  type: 'tool_call'
  id: string
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  output?: string
  error?: string
  success?: boolean
  durationMs?: number
  status: 'running' | 'success' | 'error'
}

export interface ReasoningMessage {
  type: 'reasoning'
  id: string
  phase: 'think' | 'analyze'
  text: string
}

export interface GenerativeUIMessage {
  type: 'generative_ui'
  id: string
  component: string
  props: Record<string, unknown>
}

export interface ErrorMessage {
  type: 'error'
  id: string
  message: string
  error?: { title?: string; type?: string }
  retryable: boolean
}

export interface SystemNotice {
  type: 'notice'
  id: string
  title?: string
  message: string
}

export type ChatMessage =
  | UserMessage
  | AgentTextMessage
  | ToolCallMessage
  | ReasoningMessage
  | GenerativeUIMessage
  | ErrorMessage
  | SystemNotice

// --- Supporting types ---

export interface Citation {
  refId: string
  rowNumber: number
  sourceTitle: string
}

export interface FileAttachment {
  filePath: string
  fileName: string
  mimeType: string
}

export interface ToolCallState {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  startTime: number
}

export interface ApprovalState {
  requestId: string
  command: string
  expiresAt: number
}

// --- Session types ---

export interface AgentSession {
  session_id: string
  title: string | null
  project_id: string | null
  provider_id: string | null
  created_at: string
  updated_at: string
  message_count: number
  metadata: Record<string, unknown>
}

// --- Agent event types (from WebSocket) ---

export type ChatEventState =
  | 'thinking'
  | 'thinking_text'
  | 'thinking_done'
  | 'delta'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'final'
  | 'error'
  | 'retrying'
  | 'aborted'

export interface ChatEventPayload {
  state: ChatEventState
  sessionKey?: string
  runId?: string
  text?: string
  toolCallId?: string
  toolName?: string
  arguments?: Record<string, unknown>
  success?: boolean
  result?: string
  error?: string | { title?: string; type?: string; message?: string }
  message?: string
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
  retryAfterMs?: number
}

// --- Legacy compat (kept for existing code that imports from here) ---

/** @deprecated Use AgentTextMessage instead */
export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string | null
  generativeUIComponent: string | null
  generativeUIProps: Record<string, unknown> | null
  timestamp: string
}

/** @deprecated Use AgentSession instead */
export interface AgentConversation {
  id: string
  messages: AgentMessage[]
  createdAt: string
  updatedAt: string
}
