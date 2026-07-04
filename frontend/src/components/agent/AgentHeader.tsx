import { ChevronDown, Plus, X } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { CostMeter } from './CostMeter'
import type { AgentSession } from '@/types/agent'

interface AgentHeaderProps {
  sessions: AgentSession[]
  activeSessionKey: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  onSessionSwitch: (key: string) => void
  onSessionCreate: () => void
  onCollapse: () => void
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function AgentHeader({
  sessions,
  activeSessionKey,
  inputTokens,
  outputTokens,
  estimatedCost,
  onSessionSwitch,
  onSessionCreate,
  onCollapse,
}: AgentHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeSession = sessions.find((s) => s.key === activeSessionKey)

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <span className="text-sm font-medium">Agent</span>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
        >
          {activeSession?.title ?? activeSessionKey}
          <ChevronDown className="h-3 w-3" />
        </button>
        {dropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded border border-border bg-popover shadow-lg">
            {sessions.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => { onSessionSwitch(s.key); setDropdownOpen(false) }}
                className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-accent text-left"
              >
                <span className="truncate">{s.title ?? s.key}</span>
                {s.replying && <span className="ml-auto text-[10px] text-blue-400">typing</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { onSessionCreate(); setDropdownOpen(false) }}
              className="flex w-full items-center gap-1 border-t border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Plus className="h-3 w-3" /> New session
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <CostMeter inputTokens={inputTokens} outputTokens={outputTokens} estimatedCost={estimatedCost} />

      <button
        type="button"
        onClick={onCollapse}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        aria-label="Close agent panel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
