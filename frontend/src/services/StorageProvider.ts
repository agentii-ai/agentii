export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  lastModified?: string
}

export interface StorageProvider {
  list(path: string): Promise<FileEntry[]>
  read(path: string): Promise<Uint8Array>
  readText(path: string): Promise<string>
  write(path: string, data: Uint8Array | string): Promise<void>
  delete(path: string): Promise<void>
  upload(path: string, file: File): Promise<void>
  exists(path: string): Promise<boolean>
}
