// T021 — MCP Server types (updated for registry-backed architecture)
// Legacy types retained for backward compatibility; new code uses extension-registry.ts types.
import type { ConfigField, ConfigStatus } from './extension-registry'

export type MCPTransport = 'stdio' | 'sse' | 'streamable-http'
export type MCPStatus = 'connected' | 'disconnected' | 'error' | 'connecting'

export interface MCPServer {
  id: string
  name: string
  description?: string
  transport: MCPTransport
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
  envVars: Record<string, string>
  timeout: number
  enabled: boolean
  status: MCPStatus
  toolCount?: number
  tools?: string[]
  errorMessage?: string
  // New fields from registry
  configStatus?: ConfigStatus
  configFields?: ConfigField[]
  compatibility?: string[]
}

export interface ProjectMCPOverrides {
  [serverId: string]: boolean
}
