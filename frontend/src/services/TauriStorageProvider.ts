import type { FileEntry, StorageProvider } from './StorageProvider'

/**
 * Tauri desktop storage provider using the local filesystem.
 * Stub implementation — methods will be wired to @tauri-apps/plugin-fs
 * once the Tauri shell is integrated.
 */
export class TauriStorageProvider implements StorageProvider {
  private basePath: string

  constructor(projectId: string) {
    // TODO: resolve actual project directory from Tauri app data path
    this.basePath = projectId
  }

  async list(path: string): Promise<FileEntry[]> {
    // TODO: use readDir from @tauri-apps/plugin-fs
    // const { readDir } = await import('@tauri-apps/plugin-fs')
    // const entries = await readDir(`${this.basePath}/${path}`)
    // return entries.map(...)
    console.warn('TauriStorageProvider.list() not yet implemented')
    return []
  }

  async read(path: string): Promise<Uint8Array> {
    // TODO: use readFile from @tauri-apps/plugin-fs
    // const { readFile } = await import('@tauri-apps/plugin-fs')
    // return await readFile(`${this.basePath}/${path}`)
    console.warn('TauriStorageProvider.read() not yet implemented')
    return new Uint8Array()
  }

  async readText(path: string): Promise<string> {
    // TODO: use readTextFile from @tauri-apps/plugin-fs
    // const { readTextFile } = await import('@tauri-apps/plugin-fs')
    // return await readTextFile(`${this.basePath}/${path}`)
    console.warn('TauriStorageProvider.readText() not yet implemented')
    return ''
  }

  async write(path: string, data: Uint8Array | string): Promise<void> {
    // TODO: use writeFile / writeTextFile from @tauri-apps/plugin-fs
    void path
    void data
    console.warn('TauriStorageProvider.write() not yet implemented')
  }

  async delete(path: string): Promise<void> {
    // TODO: use remove from @tauri-apps/plugin-fs
    void path
    console.warn('TauriStorageProvider.delete() not yet implemented')
  }

  async upload(path: string, file: File): Promise<void> {
    // TODO: read File as ArrayBuffer, then writeFile via Tauri
    void path
    void file
    console.warn('TauriStorageProvider.upload() not yet implemented')
  }

  async exists(path: string): Promise<boolean> {
    // TODO: use exists from @tauri-apps/plugin-fs
    void path
    console.warn('TauriStorageProvider.exists() not yet implemented')
    return false
  }
}
