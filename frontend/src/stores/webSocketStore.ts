import { create } from 'zustand'

interface WebSocketStore {
  status: 'disconnected' | 'connecting' | 'handshaking' | 'connected'
  lastError: string | null
  reconnectAttempt: number
  setStatus: (status: WebSocketStore['status']) => void
  setError: (error: string | null) => void
  setReconnectAttempt: (n: number) => void
}

export const useWebSocketStore = create<WebSocketStore>()((set) => ({
  status: 'disconnected',
  lastError: null,
  reconnectAttempt: 0,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ lastError: error }),
  setReconnectAttempt: (n) => set({ reconnectAttempt: n }),
}))
