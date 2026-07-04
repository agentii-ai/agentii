import type { StorageProvider } from './StorageProvider'
import { GatewayStorageProvider } from './GatewayStorageProvider'
import { TauriStorageProvider } from './TauriStorageProvider'

export function createStorageProvider(projectId: string): StorageProvider {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI__) {
    return new TauriStorageProvider(projectId)
  }
  // Local-deploy MVP: read files from the gateway's local workspace API
  // instead of Supabase Storage. The gateway serves files from
  // ~/.agentii/workspaces/local/{project_id}/ which is the same directory
  // the terminal PTY runs in — keeping file tree and terminal in sync.
  return new GatewayStorageProvider(projectId)
}
