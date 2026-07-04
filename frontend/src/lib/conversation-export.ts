// T013 — Conversation export utilities
import type { AgentSession } from '@/types/session-history'

export function exportAsMarkdown(session: AgentSession): string {
  const lines: string[] = [
    `# Agent Session: ${session.title}`,
    `**Date**: ${new Date(session.startedAt).toLocaleString()} | **Duration**: ${formatDuration(session.durationMs)} | **Tools used**: ${session.toolCallCount}`,
    '',
    '---',
    '',
  ]

  for (const msg of session.messages) {
    lines.push(`## ${msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Agent' : 'System'}`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')

    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        lines.push(`### Tool Call: ${tc.toolName}`)
        lines.push('```json')
        lines.push(tc.input)
        lines.push('```')
        lines.push(`**Result** (${tc.success ? 'success' : 'error'}, ${tc.durationMs}ms):`)
        lines.push('```json')
        lines.push(tc.output)
        lines.push('```')
        lines.push('')
      }
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

export function exportAsJson(session: AgentSession): string {
  return JSON.stringify(session, null, 2)
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
