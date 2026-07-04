import { GATEWAY_WS_URL } from './gateway'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
export const WS_URL = import.meta.env.VITE_WS_URL || `${GATEWAY_WS_URL}/ws/chat`

// Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/** @deprecated Mock mode is no longer the default. Use real backend. */
export function isMockMode(): boolean {
  return import.meta.env.VITE_MOCK_API === 'true'
}

export function hasSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}
