import { useEffect, useRef, useCallback, useState } from 'react'
import { useAgentOverlayStore } from '@/stores/agentOverlayStore'
import type { AgentStructuredEvent } from '@/types/terminal'
import { GATEWAY_WS_URL } from '@/config/gateway'
const INITIAL_RECONNECT_DELAY = 1_000
const MAX_RECONNECT_DELAY = 15_000

interface UseAgentChannel2Options {
  sessionId: string
  enabled: boolean
  /** Dynamic Channel 2 URL from terminal.create RPC response */
  channel2Url?: string
}

/**
 * Channel 2 structured API WebSocket from `agentii serve` inside VM.
 * Only connects when `enabled` is true (agentii tabs only).
 * Dispatches typed events to agentOverlayStore.
 */
export function useAgentChannel2({ sessionId, enabled, channel2Url }: UseAgentChannel2Options) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const [connected, setConnected] = useState(false)

  const pushApproval = useAgentOverlayStore((s) => s.pushApproval)
  const updateCost = useAgentOverlayStore((s) => s.updateCost)
  const setToolCall = useAgentOverlayStore((s) => s.setToolCall)
  const clearToolCall = useAgentOverlayStore((s) => s.clearToolCall)
  const setGenerativeUI = useAgentOverlayStore((s) => s.setGenerativeUI)
  const resetAll = useAgentOverlayStore((s) => s.resetAll)

  const handleEvent = useCallback((event: AgentStructuredEvent) => {
    switch (event.type) {
      case 'GENERATIVE_UI':
        setGenerativeUI(event.payload)
        break
      case 'APPROVAL_REQUEST':
        pushApproval(event.payload)
        break
      case 'COST_UPDATE':
        updateCost(event.payload)
        break
      case 'TOOL_CALL_START':
        setToolCall(event.payload)
        break
      case 'TOOL_CALL_END':
        clearToolCall(event.payload.toolCallId)
        break
    }
  }, [setGenerativeUI, pushApproval, updateCost, setToolCall, clearToolCall])

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (!enabled || !sessionId) {
      // Disconnect and reset when disabled (tab switch away from agentii)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      setConnected(false)
      resetAll()
      return
    }

    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return
      }

      // Use dynamic URL from terminal.create response, or fall back to default port
      const url = channel2Url ?? `${GATEWAY_WS_URL}/ws/agent/${sessionId}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
      }

      ws.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data as string) as AgentStructuredEvent
          if (event && typeof event.type === 'string') {
            handleEvent(event)
          }
        } catch {
          // Ignore malformed Channel 2 frames
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        // Reconnect with exponential backoff if still enabled
        if (enabled) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null
            connect()
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 2,
              MAX_RECONNECT_DELAY,
            )
          }, reconnectDelayRef.current)
        }
      }

      ws.onerror = () => {
        // onclose will fire after onerror
      }
    }

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      setConnected(false)
    }
  }, [enabled, sessionId, channel2Url, handleEvent, resetAll])

  /** Send approval decision back to agentii serve via Channel 2 */
  const resolveApproval = useCallback(
    (requestId: string, decision: 'approved' | 'denied') => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      ws.send(JSON.stringify({
        type: 'APPROVAL_RESPONSE',
        payload: { requestId, decision },
      }))

      useAgentOverlayStore.getState().resolveApproval(requestId)
    },
    [],
  )

  return { connected, resolveApproval }
}
