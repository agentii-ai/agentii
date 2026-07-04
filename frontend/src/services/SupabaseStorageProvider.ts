import type { SupabaseClient } from '@supabase/supabase-js'
import type { FileEntry, StorageProvider } from './StorageProvider'

const BUCKET = 'project-files'

export class SupabaseStorageProvider implements StorageProvider {
  private bucket
  private prefix: string

  constructor(
    private projectId: string,
    supabase: SupabaseClient,
  ) {
    this.bucket = supabase.storage.from(BUCKET)
    this.prefix = projectId
  }

  private fullPath(path: string): string {
    const clean = path.replace(/^\/+/, '')
    return clean ? `${this.prefix}/${clean}` : this.prefix
  }

  async list(path: string): Promise<FileEntry[]> {
    const prefix = this.fullPath(path)
    const { data, error } = await this.bucket.list(prefix, {
      limit: 200,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Failed to list ${path}: ${error.message}`)
    if (!data) return []

    return data
      .filter((item) => item.name !== '.emptyFolderPlaceholder')
      .map((item) => ({
        name: item.name,
        path: path.replace(/\/+$/, '') + '/' + item.name,
        isDirectory: item.id === null,
        size: item.metadata?.size as number | undefined,
        lastModified: item.updated_at ?? undefined,
      }))
  }

  async read(path: string): Promise<Uint8Array> {
    const { data, error } = await this.bucket.download(this.fullPath(path))
    if (error) throw new Error(`Failed to read ${path}: ${error.message}`)
    const buffer = await data.arrayBuffer()
    return new Uint8Array(buffer)
  }

  async readText(path: string): Promise<string> {
    const { data, error } = await this.bucket.download(this.fullPath(path))
    if (error) throw new Error(`Failed to read ${path}: ${error.message}`)
    return await data.text()
  }

  async write(path: string, data: Uint8Array | string): Promise<void> {
    const body = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : new Blob([data])
    const { error } = await this.bucket.upload(this.fullPath(path), body, { upsert: true })
    if (error) throw new Error(`Failed to write ${path}: ${error.message}`)
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.bucket.remove([this.fullPath(path)])
    if (error) throw new Error(`Failed to delete ${path}: ${error.message}`)
  }

  async upload(path: string, file: File): Promise<void> {
    const { error } = await this.bucket.upload(this.fullPath(path), file, {
      contentType: file.type,
      upsert: true,
    })
    if (error) throw new Error(`Failed to upload ${path}: ${error.message}`)
  }

  async exists(path: string): Promise<boolean> {
    const { error } = await this.bucket.download(this.fullPath(path))
    return !error
  }
}
