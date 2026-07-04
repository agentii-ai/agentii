/** File upload configuration and types (FR-012) */

/** Blocked executable file extensions */
export const BLOCKED_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.app', '.bat', '.cmd',
  '.com', '.msi', '.deb', '.rpm', '.dmg', '.wasm', '.elf', '.bin',
] as const

/** Upload limits to protect VM performance */
export const UPLOAD_CONFIG = {
  maxFileSizeMB: 50,
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxBatchFiles: 20,
  workspaceSoftLimitGB: 2,
} as const

export interface SanitizeResult {
  originalName: string
  sanitizedName: string
  hash6: string
}

export interface UploadResult {
  success: boolean
  filePath: string
  originalName: string
  sanitizedName: string
  error?: string
}

export type UploadErrorReason = 'too_large' | 'blocked_extension' | 'batch_limit' | 'write_failed'

export interface UploadRejection {
  fileName: string
  reason: UploadErrorReason
  detail: string
}
