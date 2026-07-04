import { useState, useCallback, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'
import { useAgentStore } from '@/stores/agentStore'
import type { AgentSession } from '@/types/agent'

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function useAgentSessions() {
  const { sendRpc, status } = useWebSocket()
  const sessions = useAgentStore((s) => s.sessions)
  const setSessions = useAgentStore((s) => s.setSessions)
  const setSessionId = useAgentStore((s) => s.setSessionId)
  const loadHistory = useAgentStore((s) => s.loadHistory)
  const [isLoading, setIsLoading] = useState(false)

  const refreshSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await sendRpc<{ sessions: AgentSession[] }>('sessions.list', {})
      setSessions(res?.sessions ?? [])
    } catch {
      // not connected
    } finally {
      setIsLoading(false)
    }
  }, [sendRpc, setSessions])

  const switchSession = useCallback(async (sessionId: string) => {
    try {
      const res = await sendRpc<{ session: AgentSession; history?: unknown[] }>('sessions.switch', {
        session_id: sessionId,
        include_history: true,
      })
      setSessionId(sessionId)
      if (res?.history) {
        loadHistory(res.history as never[])
      }
    } catch {
      // ignore
    }
  }, [sendRpc, setSessionId, loadHistory])

  const createSession = useCallback(async (projectId?: string): Promise<string> => {
    const res = await sendRpc<{ session: AgentSession }>('sessions.create', {
      ...(projectId ? { project_id: projectId } : {}),
    })
    const id = res?.session?.session_id ?? `sess-${Date.now()}`
    setSessionId(id)
    await refreshSessions()
    return id
  }, [sendRpc, setSessionId, refreshSessions])

  const deleteSession = useCallback(async (sessionId: string) => {
    await sendRpc('sessions.delete', { session_id: sessionId })
    await refreshSessions()
  }, [sendRpc, refreshSessions])

  useEffect(() => {
    if (status === 'connected') {
      refreshSessions()
    }
  }, [status, refreshSessions])

  return { sessions, isLoading, switchSession, createSession, deleteSession, refreshSessions }
}
