import { create } from 'zustand'
import type {
  ChatMessage,
  UserMessage,
  AgentTextMessage,
  ToolCallMessage,
  GenerativeUIMessage,
  ErrorMessage,
  ApprovalState,
  FileAttachment,
  AgentSession,
} from '@/types/agent'

interface AgentStore {
  sessionId: string
  messages: ChatMessage[]
  isStreaming: boolean
  activeRunId: string | null
  streamingText: string
  pendingApproval: ApprovalState | null
  sessionTokens: { input: number; output: number }
  estimatedCostUsd: number
  sessions: AgentSession[]

  addUserMessage: (text: string, attachments?: FileAttachment[]) => void
  appendDelta: (text: string) => void
  finalizeMessage: (msg: Omit<AgentTextMessage, 'type' | 'id' | 'timestamp'>) => void
  addToolCall: (tc: ToolCallMessage) => void
  updateToolCall: (toolCallId: string, update: Partial<ToolCallMessage>) => void
  addGenerativeUI: (msg: GenerativeUIMessage) => void
  addReasoningMessage: (phase: 'think' | 'analyze', text: string) => void
  appendReasoningDelta: (text: string) => void
  setApproval: (approval: ApprovalState | null) => void
  addError: (msg: ErrorMessage) => void
  clearMessages: () => void
  setSessionId: (id: string) => void
  setStreaming: (streaming: boolean, runId?: string | null) => void
  updateCost: (input: number, output: number) => void
  setSessions: (sessions: AgentSession[]) => void
  loadHistory: (messages: ChatMessage[]) => void
}

let msgCounter = 0
function nextId(): string {
  return `msg-${Date.now()}-${++msgCounter}`
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export const useAgentStore = create<AgentStore>()((set, get) => ({
  sessionId: 'main',
  messages: [],
  isStreaming: false,
  activeRunId: null,
  streamingText: '',
  pendingApproval: null,
  sessionTokens: { input: 0, output: 0 },
  estimatedCostUsd: 0,
  sessions: [],

  addUserMessage: (text, attachments = []) => {
    const msg: UserMessage = {
      type: 'user',
      id: nextId(),
      text,
      attachments,
      timestamp: Date.now(),
    }
    set({ messages: [...get().messages, msg] })
  },

  appendDelta: (text) => set({ streamingText: get().streamingText + text }),

  finalizeMessage: (partial) => {
    const msg: AgentTextMessage = {
      type: 'agent',
      id: nextId(),
      text: get().streamingText || partial.text,
      citations: partial.citations ?? [],
      model: partial.model,
      provider: partial.provider,
      durationMs: partial.durationMs,
      timestamp: Date.now(),
    }
    set({ messages: [...get().messages, msg], streamingText: '' })
  },

  addToolCall: (tc) => set({ messages: [...get().messages, tc] }),

  updateToolCall: (toolCallId, update) =>
    set({
      messages: get().messages.map((m) =>
        m.type === 'tool_call' && m.toolCallId === toolCallId ? { ...m, ...update } : m,
      ),
    }),

  addGenerativeUI: (msg) => set({ messages: [...get().messages, msg] }),

  addReasoningMessage: (phase, text) =>
    set({
      messages: [...get().messages, { type: 'reasoning' as const, id: nextId(), phase, text }],
    }),

  appendReasoningDelta: (text) => {
    const msgs = [...get().messages]
    const last = msgs[msgs.length - 1]
    if (last?.type === 'reasoning') {
      msgs[msgs.length - 1] = { ...last, text: last.text + text }
      set({ messages: msgs })
    }
  },

  setApproval: (approval) => set({ pendingApproval: approval }),

  addError: (msg) => set({ messages: [...get().messages, msg] }),

  clearMessages: () => set({ messages: [], streamingText: '', activeRunId: null }),

  setSessionId: (id) => set({ sessionId: id }),

  setStreaming: (streaming, runId) =>
    set({ isStreaming: streaming, activeRunId: runId ?? (streaming ? get().activeRunId : null) }),

  updateCost: (input, output) => {
    const cost = (input * 3 + output * 15) / 1_000_000
    set({ sessionTokens: { input, output }, estimatedCostUsd: cost })
  },

  setSessions: (sessions) => set({ sessions }),

  loadHistory: (messages) => set({ messages }),
}))
