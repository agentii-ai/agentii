/**
 * @deprecated Use useWebSocket instead. This shim exists for backward compatibility
 * with existing Trading window consumers during migration.
 */
import { useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

type EventHandler = (data: unknown) => void

interface UseSocketReturn {
  isConnected: boolean
  subscribe: (event: string, handler: EventHandler) => void
  unsubscribe: (event: string, handler: EventHandler) => void
  emit: (event: string, data: unknown) => void
}

export function useSocket(): UseSocketReturn {
  const { status, onEvent, sendRpc } = useWebSocket()

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    onEvent(event, (payload) => handler(payload))
  }, [onEvent])

  const unsubscribe = useCallback((_event: string, _handler: EventHandler) => {
    // onEvent returns cleanup; callers should use the returned unsubscribe
  }, [])

  const emit = useCallback((event: string, data: unknown) => {
    sendRpc(event, (data as Record<string, unknown>) ?? {}).catch(() => {})
  }, [sendRpc])

  return { isConnected: status === 'connected', subscribe, unsubscribe, emit }
}
