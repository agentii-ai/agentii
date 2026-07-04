import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GATEWAY_HTTP_URL } from '@/config/gateway'
import type {
  SkillsListResponse,
  McpListResponse,
  ConfigureResponse,
  ToggleResponse,
} from '@/types/extension-registry'

// ---------------------------------------------------------------------------
// API helpers — POST to backend RPC endpoints
// ---------------------------------------------------------------------------

const API_BASE = GATEWAY_HTTP_URL

async function rpc<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/api/settings/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.message || `RPC failed: ${res.status}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Skills hooks
// ---------------------------------------------------------------------------

export function useSkillsList() {
  return useQuery<SkillsListResponse>({
    queryKey: ['settings', 'skills'],
    queryFn: () => rpc<SkillsListResponse>('skills/list'),
    staleTime: 30_000,
  })
}

export function useSkillsConfigure() {
  const qc = useQueryClient()
  return useMutation<ConfigureResponse, Error, { repoId: string; values: Record<string, string> }>({
    mutationFn: ({ repoId, values }) =>
      rpc<ConfigureResponse>('skills/configure', { repoId, values }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'skills'] })
    },
  })
}

export function useSkillsToggle() {
  const qc = useQueryClient()
  return useMutation<ToggleResponse, Error, { repoId: string; enabled: boolean }>({
    mutationFn: ({ repoId, enabled }) =>
      rpc<ToggleResponse>('skills/toggle', { repoId, enabled }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'skills'] })
    },
  })
}

// ---------------------------------------------------------------------------
// MCP hooks
// ---------------------------------------------------------------------------

export function useMcpList() {
  return useQuery<McpListResponse>({
    queryKey: ['settings', 'mcp'],
    queryFn: () => rpc<McpListResponse>('mcp/list'),
    staleTime: 30_000,
  })
}

export function useMcpConfigure() {
  const qc = useQueryClient()
  return useMutation<ConfigureResponse, Error, { serverId: string; values: Record<string, string> }>({
    mutationFn: ({ serverId, values }) =>
      rpc<ConfigureResponse>('mcp/configure', { serverId, values }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'mcp'] })
    },
  })
}

export function useMcpToggle() {
  const qc = useQueryClient()
  return useMutation<ToggleResponse, Error, { serverId: string; enabled: boolean }>({
    mutationFn: ({ serverId, enabled }) =>
      rpc<ToggleResponse>('mcp/toggle', { serverId, enabled }),
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'mcp'] })
    },
  })
}
