import { useEffect, useState, useCallback } from 'react'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useIDEStore } from '@/stores/ideStore'
import { MarkdownViewer } from './MarkdownViewer'
import { CodeEditor } from './CodeEditor'
import { CSVEditor } from './CSVViewer'
import { PDFViewer } from './PDFViewer'
import { JSONViewer } from './JSONViewer'

interface FileRendererProps {
  filePath: string
  viewMode?: 'source' | 'preview' | 'split'
}

/** Text-based extensions that CodeMirror can handle */
const TEXT_EXTENSIONS = new Set([
  'py', 'js', 'jsx', 'ts', 'tsx', 'rs', 'go', 'c', 'cpp', 'h', 'hpp',
  'sql', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'htm', 'css',
  'sh', 'bash', 'zsh', 'env', 'txt', 'log', 'ini', 'cfg', 'conf',
  'dockerfile', 'makefile', 'gitignore', 'editorconfig',
  'md', 'mdx', 'rst', 'tex',
  'r', 'rb', 'php', 'java', 'kt', 'scala', 'swift', 'dart',
  'lua', 'vim', 'zig', 'nim', 'ex', 'exs', 'erl', 'hs',
])

function getExtension(filePath: string): string {
  const name = filePath.split('/').pop() ?? ''
  // Handle dotfiles like .env.local, .gitignore
  if (name.startsWith('.') && !name.includes('.', 1)) {
    return name.slice(1) // .gitignore → gitignore
  }
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function isTextFile(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext)
}

export function FileRenderer({ filePath, viewMode = 'source' }: FileRendererProps) {
  const { readFile, writeFile } = useFileSystem()
  const storageProvider = useIDEStore((s) => s.storageProvider)
  const updateTabDirty = useIDEStore((s) => s.updateTabDirty)
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ext = getExtension(filePath)

  useEffect(() => {
    setLoading(true)
    setError(null)

    if (storageProvider) {
      storageProvider
        .readText(filePath)
        .then((text) => setContent(text))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    } else {
      readFile(filePath)
        .then((result) => setContent(result.content))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [filePath, readFile, storageProvider])

  const handleSave = useCallback(
    async (value: string) => {
      try {
        if (storageProvider) {
          await storageProvider.write(filePath, value)
        } else {
          await writeFile(filePath, value)
        }
        updateTabDirty(filePath, false)
        setContent(value)
      } catch (err) {
        console.error('Save failed:', err)
      }
    },
    [filePath, storageProvider, writeFile, updateTabDirty],
  )

  const handleChange = useCallback(
    (value: string) => {
      setContent(value)
      updateTabDirty(filePath, true)
    },
    [filePath, updateTabDirty],
  )

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-destructive">Error: {error}</div>
  }

  // Route by file type
  // Markdown: rich preview by default, source toggle opens CodeMirror
  if (ext === 'md' || ext === 'mdx') {
    if (viewMode === 'source') {
      return <CodeEditor content={content} language="md" onChange={handleChange} onSave={handleSave} />
    }
    return <MarkdownViewer content={content} />
  }

  // CSV/XLSX: table editor with inline cell editing
  if (ext === 'csv' || ext === 'xlsx') {
    return <CSVEditor content={content} onChange={handleChange} onSave={handleSave} />
  }

  // PDF: read-only viewer
  if (ext === 'pdf') {
    return <PDFViewer filePath={filePath} />
  }

  // JSON: CodeMirror with JSON mode (collapsible via foldGutter)
  if (ext === 'json') {
    return <CodeEditor content={content} language="json" onChange={handleChange} onSave={handleSave} />
  }

  // All other text files: CodeMirror with auto-detected syntax
  if (isTextFile(ext)) {
    return <CodeEditor content={content} language={ext} onChange={handleChange} onSave={handleSave} />
  }

  // Unknown extension: try CodeMirror as plain text (no syntax highlighting)
  return <CodeEditor content={content} onChange={handleChange} onSave={handleSave} />
}
