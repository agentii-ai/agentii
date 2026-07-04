// T054 — Session export button
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download } from 'lucide-react'
import { exportAsMarkdown, exportAsJson, downloadFile } from '@/lib/conversation-export'
import type { AgentSession } from '@/types/session-history'

interface SessionExportButtonProps {
  session: AgentSession
}

export function SessionExportButton({ session }: SessionExportButtonProps) {
  const handleExport = (format: string) => {
    const slug = session.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)
    const date = new Date(session.startedAt).toISOString().slice(0, 10)
    if (format === 'markdown') {
      const content = exportAsMarkdown(session)
      downloadFile(content, `session-${slug}-${date}.md`, 'text/markdown')
    } else {
      const content = exportAsJson(session)
      downloadFile(content, `session-${slug}-${date}.json`, 'application/json')
    }
  }

  return (
    <Select onValueChange={handleExport}>
      <SelectTrigger className="h-7 w-auto text-xs gap-1 border-border" aria-label="Export session">
        <Download className="h-3 w-3" />
        <SelectValue placeholder="Export" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="markdown" className="text-xs">Markdown</SelectItem>
        <SelectItem value="json" className="text-xs">JSON</SelectItem>
      </SelectContent>
    </Select>
  )
}
