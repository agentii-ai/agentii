import { useState, useCallback } from 'react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { sanitizeFilename } from '@/utils/sanitizeFilename'
import { useToastStore } from '@/stores/toastStore'
import { BLOCKED_EXTENSIONS, UPLOAD_CONFIG, type UploadResult, type UploadRejection } from '@/types/upload'

interface UseFileUploadOptions {
  targetFolder: string
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

function isBlocked(name: string): boolean {
  const ext = getExtension(name)
  return (BLOCKED_EXTENSIONS as readonly string[]).includes(ext)
}

export function useFileUpload({ targetFolder }: UseFileUploadOptions) {
  const { writeFile } = useFileSystem()
  const addToast = useToastStore((s) => s.addToast)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      const results: UploadResult[] = []
      const rejections: UploadRejection[] = []

      // Batch limit check
      if (files.length > UPLOAD_CONFIG.maxBatchFiles) {
        addToast(`Maximum ${UPLOAD_CONFIG.maxBatchFiles} files per upload. Got ${files.length}.`, 'error')
        return []
      }

      // Pre-validate all files
      const validFiles: File[] = []
      for (const file of files) {
        if (isBlocked(file.name)) {
          rejections.push({
            fileName: file.name,
            reason: 'blocked_extension',
            detail: `Executable files are not allowed: ${file.name}`,
          })
          continue
        }
        if (file.size > UPLOAD_CONFIG.maxFileSizeBytes) {
          rejections.push({
            fileName: file.name,
            reason: 'too_large',
            detail: `File exceeds ${UPLOAD_CONFIG.maxFileSizeMB} MB limit: ${file.name}`,
          })
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length === 0 && rejections.length > 0) {
        for (const r of rejections) {
          addToast(r.detail, 'error')
        }
        return []
      }

      setUploading(true)
      setProgress(0)

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        try {
          const buffer = await file.arrayBuffer()
          const { sanitizedName } = await sanitizeFilename(file.name, buffer)

          const folder = targetFolder.endsWith('/') ? targetFolder : `${targetFolder}/`
          const filePath = `${folder}${sanitizedName}`.replace(/\/+/g, '/')

          // Write file content
          const content = new Uint8Array(buffer)
          await writeFile(filePath, content as unknown as string)

          results.push({
            success: true,
            filePath,
            originalName: file.name,
            sanitizedName,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Write failed'
          results.push({
            success: false,
            filePath: '',
            originalName: file.name,
            sanitizedName: '',
            error: message,
          })
          rejections.push({
            fileName: file.name,
            reason: 'write_failed',
            detail: `Failed to write ${file.name}: ${message}`,
          })
        }

        setProgress(Math.round(((i + 1) / validFiles.length) * 100))
      }

      setUploading(false)
      setProgress(0)

      // Toast notifications
      const succeeded = results.filter((r) => r.success).length
      const failed = rejections.length

      if (succeeded > 0 && failed === 0) {
        addToast(`${succeeded} file${succeeded !== 1 ? 's' : ''} uploaded to ${targetFolder}`, 'success')
      } else if (succeeded > 0 && failed > 0) {
        addToast(`${succeeded} uploaded, ${failed} rejected`, 'warning')
      } else if (failed > 0) {
        for (const r of rejections.slice(0, 3)) {
          addToast(r.detail, 'error')
        }
        if (rejections.length > 3) {
          addToast(`...and ${rejections.length - 3} more rejected`, 'error')
        }
      }

      return results
    },
    [targetFolder, writeFile, addToast],
  )

  return { uploadFiles, uploading, progress }
}
