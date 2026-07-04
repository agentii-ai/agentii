/** Moltis JSON-RPC WebSocket protocol types */

export interface RpcRequest {
  type: 'req'
  id: string
  method: string
  params: Record<string, unknown>
}

export interface RpcResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: Record<string, unknown>
  error?: { code: string; message: string }
}

export interface RpcEvent {
  type: 'event'
  event: string
  payload: Record<string, unknown>
  stream?: string
  done?: boolean
}

export type RpcFrame = RpcRequest | RpcResponse | RpcEvent

export interface ConnectParams {
  protocol: { min: number; max: number }
  client: { id: string; version: string; platform: string; mode: string }
  locale: string
  timezone: string
}
