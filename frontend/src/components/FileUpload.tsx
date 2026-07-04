import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

interface FileUploadProps {
  projectId: string
  onUploadComplete?: () => void
}

export function FileUpload({ projectId, onUploadComplete }: FileUploadProps) {
  const { user } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB per FR-025

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!user) return
      setUploading(true)
      try {
        const basePath = `${projectId}`
        for (const file of Array.from(files)) {
          if (file.size > MAX_FILE_SIZE) {
            console.warn(`Skipping ${file.name}: exceeds 50MB limit`)
            continue
          }
          const { error } = await supabase.storage.from('project-files').upload(`${basePath}/${file.name}`, file, { upsert: true })
          if (error) console.error(`Upload failed for ${file.name}:`, error.message)
        }
        onUploadComplete?.()
      } finally {
        setUploading(false)
      }
    },
    [user, projectId, onUploadComplete],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files)
      }
    },
    [uploadFiles],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFiles(e.target.files)
      }
    },
    [uploadFiles],
  )

  return (
    <div
      className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
      </p>
      <input
        type="file"
        multiple
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={handleFileInput}
        disabled={uploading}
      />
    </div>
  )
}
