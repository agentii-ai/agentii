// T050 — Slash Command palette
import { useState, useMemo, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { useSkillsStore } from '@/stores/skillsStore'
import type { SlashCommand } from '@/types/skill'

const BUILT_IN_COMMANDS: SlashCommand[] = [
  { name: '/help', description: 'Show available commands and usage', source: 'built-in' },
  { name: '/clear', description: 'Clear the current conversation', source: 'built-in' },
  { name: '/mode', description: 'Switch agent autonomy mode', source: 'built-in' },
  { name: '/settings', description: 'Open settings page', source: 'built-in' },
]

interface SlashCommandPaletteProps {
  query: string
  onSelect: (command: SlashCommand) => void
  onDismiss: () => void
  visible: boolean
}

export function SlashCommandPalette({ query, onSelect, onDismiss, visible }: SlashCommandPaletteProps) {
  const { globalEnabled } = useSkillsStore()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo(() => {
    // Post-MVP: populate skill commands from useSkillsList() hook
    return [...BUILT_IN_COMMANDS]
  }, [globalEnabled])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().replace(/^\//, '')
    if (!q) return commands
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        onSelect(filtered[selectedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, filtered, selectedIndex, onSelect, onDismiss])

  if (!visible || filtered.length === 0) return null

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slash commands"
      className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded shadow-lg max-h-48 overflow-y-auto z-50"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name + cmd.source}
          role="option"
          aria-selected={i === selectedIndex}
          className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
            i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          }`}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => onSelect(cmd)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono font-medium">{cmd.name}</span>
            <span className="text-[10px] text-muted-foreground truncate">{cmd.description}</span>
          </div>
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 ml-2">{cmd.source}</Badge>
        </button>
      ))}
    </div>
  )
}
