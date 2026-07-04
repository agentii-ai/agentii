import { create } from 'zustand'
import type {
  ApprovalRequestPayload,
  CostUpdatePayload,
  ToolCallStartPayload,
  GenerativeUIPayload,
} from '@/types/terminal'

interface AgentOverlayState {
  // Approval gate queue (safety-critical, FIFO)
  approvalQueue: ApprovalRequestPayload[]
  // Live cost tracking
  costData: CostUpdatePayload | null
  // Active tool call indicator
  activeToolCall: ToolCallStartPayload | null
  // GenerativeUI overlay payload (Channel 2 primary source)
  generativeUIPayload: GenerativeUIPayload | null

  // Actions
  pushApproval: (payload: ApprovalRequestPayload) => void
  resolveApproval: (requestId: string) => void
  updateCost: (payload: CostUpdatePayload) => void
  setToolCall: (payload: ToolCallStartPayload) => void
  clearToolCall: (toolCallId: string) => void
  setGenerativeUI: (payload: GenerativeUIPayload) => void
  dismissGenerativeUI: () => void
  resetAll: () => void
}

export const useAgentOverlayStore = create<AgentOverlayState>()((set) => ({
  approvalQueue: [],
  costData: null,
  activeToolCall: null,
  generativeUIPayload: null,

  pushApproval: (payload) =>
    set((state) => ({
      approvalQueue: [...state.approvalQueue, payload],
    })),

  resolveApproval: (requestId) =>
    set((state) => ({
      approvalQueue: state.approvalQueue.filter((a) => a.requestId !== requestId),
    })),

  updateCost: (payload) => set({ costData: payload }),

  setToolCall: (payload) => set({ activeToolCall: payload }),

  clearToolCall: (toolCallId) =>
    set((state) => ({
      activeToolCall: state.activeToolCall?.toolCallId === toolCallId ? null : state.activeToolCall,
    })),

  setGenerativeUI: (payload) => set({ generativeUIPayload: payload }),

  dismissGenerativeUI: () => set({ generativeUIPayload: null }),

  resetAll: () =>
    set({
      approvalQueue: [],
      costData: null,
      activeToolCall: null,
      generativeUIPayload: null,
    }),
}))
