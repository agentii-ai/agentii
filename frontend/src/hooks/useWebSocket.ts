import { useEffect, useRef, useCallback } from 'react'
import { useWebSocketStore } from '@/stores/webSocketStore'
import { useAuth } from '@/providers/AuthProvider'
import type { RpcRequest, RpcResponse, RpcFrame } from '@/types/websocket'
import { GATEWAY_WS_URL } from '@/config/gateway'

const WS_URL = import.meta.env.VITE_WS_URL || `${GATEWAY_WS_URL}/ws/chat`
const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000

type EventHandler = (payload: Record<string, unknown>, event: string) => void
type PendingRequest = { resolve: (res: RpcResponse) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }

let globalWs: WebSocket | null = null
let globalSeq = 0
const pendingRequests = new Map<string, PendingRequest>()
const eventHandlers = new Map<string, Set<EventHandler>>()
let reconnectDelay = INITIAL_RECONNECT_DELAY
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let isConnecting = false
let currentToken: string | null = null
let pausedForVisibility = false

function nextId(): string {
  return `ui-${++globalSeq}`
}

function handleFrame(frame: RpcFrame) {
  if (frame.type === 'res') {
    const pending = pendingRequests.get(frame.id)
    if (pending) {
      clearTimeout(pending.timer)
      pendingRequests.delete(frame.id)
      pending.resolve(frame)
    }
  } else if (frame.type === 'event') {
    const handlers = eventHandlers.get(frame.event)
    handlers?.forEach((h) => h(frame.payload, frame.event))
    const wildcard = eventHandlers.get('*')
    wildcard?.forEach((h) => h(frame.payload, frame.event))
  }
}

function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (globalWs) {
    globalWs.onclose = null
    globalWs.onerror = null
    globalWs.onmessage = null
    globalWs.onopen = null
    globalWs.close()
    globalWs = null
  }
  isConnecting = false
  for (const [id, p] of pendingRequests) {
    clearTimeout(p.timer)
    p.reject(new Error('WebSocket closed'))
    pendingRequests.delete(id)
  }
}

function connectWebSocket(store: ReturnType<typeof useWebSocketStore.getState>, token: string | null) {
  if (isConnecting || globalWs?.readyState === WebSocket.OPEN) return
  isConnecting = true
  currentToken = token
  store.setStatus('connecting')

  const ws = new WebSocket(WS_URL)
  globalWs = ws

  ws.onopen = () => {
    isConnecting = false
    reconnectDelay = INITIAL_RECONNECT_DELAY
    reconnectAttempt = 0
    store.setReconnectAttempt(0)
    store.setStatus('handshaking')
    store.setError(null)

    const handshake: RpcRequest = {
      type: 'req',
      id: nextId(),
      method: 'connect',
      params: {
        protocol: { min: 3, max: 4 },
        client: { id: 'agentii-web', version: '0.1.0', platform: 'browser', mode: 'operator' },
        locale: navigator.language || 'en-US',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(currentToken ? { token: currentToken } : {}),
      },
    }
    ws.send(JSON.stringify(handshake))

    const pending: PendingRequest = {
      resolve: (res) => {
        if (res.ok) {
          store.setStatus('connected')
        } else {
          store.setError(res.error?.message ?? 'Handshake failed')
          store.setStatus('disconnected')
        }
      },
      reject: () => store.setStatus('disconnected'),
      timer: setTimeout(() => {
        pendingRequests.delete(handshake.id)
        store.setError('Handshake timeout')
        store.setStatus('disconnected')
      }, 10_000),
    }
    pendingRequests.set(handshake.id, pending)
  }

  ws.onmessage = (ev) => {
    try {
      const frame = JSON.parse(ev.data as string) as RpcFrame
      handleFrame(frame)
    } catch {
      // ignore malformed frames
    }
  }

  ws.onclose = () => {
    isConnecting = false
    globalWs = null
    store.setStatus('disconnected')
    // reject all pending
    for (const [id, p] of pendingRequests) {
      clearTimeout(p.timer)
      p.reject(new Error('WebSocket closed'))
      pendingRequests.delete(id)
    }
    scheduleReconnect(store)
  }

  ws.onerror = () => {
    isConnecting = false
    store.setError('WebSocket error')
  }
}

function scheduleReconnect(store: ReturnType<typeof useWebSocketStore.getState>) {
  if (reconnectTimer || pausedForVisibility) return
  reconnectAttempt++
  store.setReconnectAttempt(reconnectAttempt)
  // Add jitter (0-25% of delay) to prevent thundering herd
  const jitter = Math.random() * reconnectDelay * 0.25
  const delay = reconnectDelay + jitter
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWebSocket(store, currentToken)
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
  }, delay)
}

function handleVisibilityChange() {
  const store = useWebSocketStore.getState()
  if (document.hidden) {
    // Tab hidden — pause reconnect attempts to save resources
    pausedForVisibility = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  } else {
    // Tab visible — reconnect immediately if disconnected
    pausedForVisibility = false
    if (!globalWs && !isConnecting) {
      reconnectDelay = INITIAL_RECONNECT_DELAY
      connectWebSocket(store, currentToken)
    }
  }
}

export function useWebSocket() {
  const status = useWebSocketStore((s) => s.status)
  const { accessToken } = useAuth()
  const initialized = useRef(false)
  const prevTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const store = useWebSocketStore.getState()

    if (!initialized.current) {
      initialized.current = true
      prevTokenRef.current = accessToken
      document.addEventListener('visibilitychange', handleVisibilityChange)
      connectWebSocket(store, accessToken)
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      }
    }

    // Reconnect when token changes (refresh or new login)
    if (accessToken !== prevTokenRef.current) {
      prevTokenRef.current = accessToken
      disconnectWebSocket()
      store.setStatus('disconnected')
      connectWebSocket(store, accessToken)
    }
  }, [accessToken])

  const sendRpc = useCallback(<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!globalWs || globalWs.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))
        return
      }
      const id = nextId()
      const req: RpcRequest = { type: 'req', id, method, params }

      const timer = setTimeout(() => {
        pendingRequests.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, 30_000)

      pendingRequests.set(id, {
        resolve: (res) => {
          if (res.ok) resolve(res.payload as T)
          else reject(new Error(res.error?.message ?? 'RPC error'))
        },
        reject,
        timer,
      })

      globalWs.send(JSON.stringify(req))
    })
  }, [])

  const subscribe = useCallback(async (events: string[]) => {
    await sendRpc('subscribe', { events })
  }, [sendRpc])

  const onEvent = useCallback((event: string, handler: EventHandler) => {
    if (!eventHandlers.has(event)) eventHandlers.set(event, new Set())
    eventHandlers.get(event)!.add(handler)
    return () => {
      eventHandlers.get(event)?.delete(handler)
    }
  }, [])

  return { status, sendRpc, subscribe, onEvent }
}
