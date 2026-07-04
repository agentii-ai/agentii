import type { FileEntry, StorageProvider } from './StorageProvider'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_HTTP_URL || 'http://localhost:3100'

/**
 * Storage provider that reads/writes files via the gateway's local workspace API.
 * Used for the macOS local-deploy MVP where files live on the host filesystem
 * at ~/.agentii/workspaces/local/{project_id}/.
 */
export class GatewayStorageProvider implements StorageProvider {
  constructor(private projectId: string) {}

  async list(path: string): Promise<FileEntry[]> {
    let resp: Response
    try {
      resp = await fetch(`${GATEWAY_URL}/api/workspace/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: this.projectId, path }),
      })
    } catch {
      // Gateway unreachable — return empty list instead of crashing
      return []
    }
    if (!resp.ok) {
      // Workspace not ready yet (404) or other error — return empty
      return []
    }
    const entries: Array<{ name: string; path: string; is_directory: boolean; size: number }> =
      await resp.json()
    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_directory,
      size: e.size,
    }))
  }

  async read(path: string): Promise<Uint8Array> {
    const text = await this.readText(path)
    return new TextEncoder().encode(text)
  }

  async readText(path: string): Promise<string> {
    const resp = await fetch(`${GATEWAY_URL}/api/workspace/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: this.projectId, path }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      throw new Error(err.error || `Failed to read ${path}`)
    }
    const data = await resp.json()
    return data.content
  }

  async write(path: string, data: Uint8Array | string): Promise<void> {
    const content = typeof data === 'string' ? data : new TextDecoder().decode(data)
    const resp = await fetch(`${GATEWAY_URL}/api/workspace/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: this.projectId, path, content }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      throw new Error(err.error || `Failed to write ${path}`)
    }
  }

  async delete(path: string): Promise<void> {
    // Not yet implemented on gateway — log warning
    console.warn(`GatewayStorageProvider.delete(${path}) not yet implemented`)
  }

  async upload(path: string, file: File): Promise<void> {
    const content = await file.text()
    await this.write(path, content)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.readText(path)
      return true
    } catch {
      return false
    }
  }
}
