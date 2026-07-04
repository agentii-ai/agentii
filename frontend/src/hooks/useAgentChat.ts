import { useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import { useAgentStore } from '@/stores/agentStore'
import type { FileAttachment } from '@/types/agent'
import { supabase } from '@/lib/supabase'

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function useAgentChat() {
  const { sendRpc } = useWebSocket()
  const addUserMessage = useAgentStore((s) => s.addUserMessage)
  const setStreaming = useAgentStore((s) => s.setStreaming)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const messages = useAgentStore((s) => s.messages)

  const sendMessage = useCallback(async (text: string, attachments?: FileAttachment[], provider?: string) => {
    addUserMessage(text, attachments)
    const sessionId = useAgentStore.getState().sessionId

    // Fetch decrypted provider key if a provider is specified
    let providerKey: string | undefined
    if (provider) {
      try {
        const { data } = await supabase.rpc('get_provider_key', { p_provider: provider })
        if (data) providerKey = data as string
      } catch {
        // fall through — backend will use its configured key
      }
    }

    try {
      await sendRpc('chat.send', {
        session_id: sessionId,
        text,
        ...(providerKey ? { provider_key: providerKey } : {}),
        ...(attachments?.length ? { attachments } : {}),
      })
    } catch {
      // WebSocket not connected — message still shown in UI
    }
  }, [sendRpc, addUserMessage])

  const abortGeneration = useCallback(async () => {
    const runId = useAgentStore.getState().activeRunId
    if (!runId) return
    try {
      await sendRpc('chat.abort', { run_id: runId })
      setStreaming(false)
    } catch {
      // ignore
    }
  }, [sendRpc, setStreaming])

  const resolveApproval = useCallback(async (requestId: string, decision: 'approved' | 'denied') => {
    const runId = useAgentStore.getState().activeRunId
    await sendRpc('exec.approval.resolve', { run_id: runId, request_id: requestId, approved: decision === 'approved' })
    useAgentStore.getState().setApproval(null)
  }, [sendRpc])

  const clearHistory = useCallback(async () => {
    const sessionId = useAgentStore.getState().sessionId
    try {
      await sendRpc('chat.clear', { session_id: sessionId })
    } catch {
      // ignore
    }
    useAgentStore.getState().clearMessages()
  }, [sendRpc])

  const loadHistory = useCallback(async () => {
    const sessionId = useAgentStore.getState().sessionId
    try {
      const res = await sendRpc<{ messages: unknown[] }>('chat.history', { session_id: sessionId })
      if (res?.messages) {
        useAgentStore.getState().loadHistory(res.messages as never[])
      }
    } catch {
      // ignore
    }
  }, [sendRpc])

  return { sendMessage, abortGeneration, resolveApproval, clearHistory, loadHistory, isStreaming, messages }
}
