import { useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { useAgentStore } from '@/stores/agentStore'

/**
 * Subscribe to per-event listeners matching the backend WebSocket contract.
 * Each `chat.*` event is handled individually instead of a single `chat` listener.
 */
/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function useAgentEvent() {
  const { onEvent, status } = useWebSocket()
  const appendDelta = useAgentStore((s) => s.appendDelta)
  const finalizeMessage = useAgentStore((s) => s.finalizeMessage)
  const addToolCall = useAgentStore((s) => s.addToolCall)
  const updateToolCall = useAgentStore((s) => s.updateToolCall)
  const setStreaming = useAgentStore((s) => s.setStreaming)
  const updateCost = useAgentStore((s) => s.updateCost)
  const addError = useAgentStore((s) => s.addError)
  const setApproval = useAgentStore((s) => s.setApproval)
  const addReasoningMessage = useAgentStore((s) => s.addReasoningMessage)
  const appendReasoningDelta = useAgentStore((s) => s.appendReasoningDelta)

  useEffect(() => {
    const unsubs: (() => void)[] = []

    unsubs.push(
      onEvent('chat.run_started', (payload) => {
        setStreaming(true, payload.run_id as string)
      }),
    )

    unsubs.push(
      onEvent('chat.text_delta', (payload) => {
        appendDelta((payload.text as string) ?? '')
      }),
    )

    unsubs.push(
      onEvent('chat.tool_call_start', (payload) => {
        addToolCall({
          type: 'tool_call',
          id: `tc-${payload.tool_call_id}`,
          toolCallId: (payload.tool_call_id as string) ?? '',
          toolName: (payload.tool_name ?? payload.name) as string ?? '',
          input: (payload.arguments as Record<string, unknown>) ?? {},
          status: 'running',
        })
      }),
    )

    unsubs.push(
      onEvent('chat.tool_call_end', (payload) => {
        updateToolCall((payload.tool_call_id as string) ?? '', {
          status: payload.success ? 'success' : 'error',
          output: payload.result as string | undefined,
          error: payload.error as string | undefined,
          success: payload.success as boolean | undefined,
          durationMs: payload.duration_ms as number | undefined,
        })
      }),
    )

    unsubs.push(
      onEvent('chat.thinking_start', () => {
        addReasoningMessage('think', '')
      }),
    )

    unsubs.push(
      onEvent('chat.thinking_delta', (payload) => {
        appendReasoningDelta((payload.text as string) ?? '')
      }),
    )

    unsubs.push(
      onEvent('chat.cost_update', (payload) => {
        updateCost(
          (payload.input_tokens as number) ?? 0,
          (payload.output_tokens as number) ?? 0,
        )
      }),
    )

    unsubs.push(
      onEvent('chat.run_finished', (payload) => {
        finalizeMessage({
          text: (payload.text as string) ?? '',
          citations: [],
          model: payload.model as string | undefined,
          provider: payload.provider as string | undefined,
          durationMs: payload.duration_ms as number | undefined,
        })
        setStreaming(false)
        if (payload.input_tokens != null && payload.output_tokens != null) {
          updateCost(payload.input_tokens as number, payload.output_tokens as number)
        }
      }),
    )

    unsubs.push(
      onEvent('chat.error', (payload) => {
        addError({
          type: 'error',
          id: `err-${Date.now()}`,
          message: (payload.message as string) ?? 'Unknown error',
          retryable: (payload.retryable as boolean) ?? false,
        })
        setStreaming(false)
      }),
    )

    unsubs.push(
      onEvent('chat.retrying', () => {
        // Retrying — keep streaming state, UI can show a retry indicator
      }),
    )

    unsubs.push(
      onEvent('exec.approval.requested', (payload) => {
        setApproval({
          requestId: payload.request_id as string,
          command: payload.command as string,
          expiresAt: Date.now() + 120_000,
        })
      }),
    )

    unsubs.push(
      onEvent('exec.approval.resolved', () => {
        setApproval(null)
      }),
    )

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [onEvent, appendDelta, finalizeMessage, addToolCall, updateToolCall, setStreaming, updateCost, addError, setApproval, addReasoningMessage, appendReasoningDelta])

  return { status }
}
