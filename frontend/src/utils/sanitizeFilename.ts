import type { SanitizeResult } from '@/types/upload'

/** Characters to replace with underscore in filenames */
const UNFAVORABLE_CHARS = /[/\\:?*"<>|#%&{}$!'@+`= ]/g

/** Compute MD5 hex digest of an ArrayBuffer using Web Crypto API */
async function md5Hex(buffer: ArrayBuffer): Promise<string> {
  // Web Crypto doesn't support MD5 directly — use a simple hash
  // For browser compat, we use SHA-256 and take last 6 chars (equally unique for dedup)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Sanitize a filename for LLM-friendly workspace storage.
 *
 * 1. Replace unfavorable characters with `_`
 * 2. Collapse consecutive underscores
 * 3. Trim leading/trailing underscores
 * 4. Compute hash of file content
 * 5. Append last 6 hex chars to filename stem
 *
 * Example: "2025/09/03:goldman sachs.pdf" → "2025_09_03_goldman_sachs_a3f2c1.pdf"
 */
export async function sanitizeFilename(
  originalName: string,
  fileContent: ArrayBuffer,
): Promise<SanitizeResult> {
  // Split into stem and extension
  const lastDot = originalName.lastIndexOf('.')
  const stem = lastDot > 0 ? originalName.slice(0, lastDot) : originalName
  const ext = lastDot > 0 ? originalName.slice(lastDot) : ''

  // Step 1: Replace unfavorable chars
  let sanitized = stem.replace(UNFAVORABLE_CHARS, '_')

  // Step 2: Collapse consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_')

  // Step 3: Trim leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '')

  // Step 4: Compute hash
  const fullHash = await md5Hex(fileContent)

  // Step 5: Append last 6 chars of hash
  const hash6 = fullHash.slice(-6)
  const sanitizedName = `${sanitized}_${hash6}${ext.toLowerCase()}`

  return { originalName, sanitizedName, hash6 }
}
