// T022 — Settings sidebar with grouped navigation
import { cn } from '@/lib/utils'
import {
  Zap, Server, FileText, Bot,
  Database, Key,
  Palette, Settings, LineChart, Bell,
  Monitor,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface SettingsSectionDef {
  id: string
  label: string
  group: 'agent' | 'data' | 'general' | 'platform'
  icon: LucideIcon
}

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  // Agent
  { id: 'skills', label: 'Skills', group: 'agent', icon: Zap },
  { id: 'mcp', label: 'MCP Servers', group: 'agent', icon: Server },
  { id: 'instructions', label: 'Project Instructions', group: 'agent', icon: FileText },
  { id: 'agent-mode', label: 'Agent Mode', group: 'agent', icon: Bot },
  // Data
  { id: 'data-providers', label: 'Data Providers', group: 'data', icon: Database },
  { id: 'llm-providers', label: 'LLM Providers', group: 'data', icon: Key },
  // General
  { id: 'appearance', label: 'Appearance', group: 'general', icon: Palette },
  { id: 'default-model', label: 'Default Model', group: 'general', icon: Settings },
  { id: 'trading', label: 'Trading Defaults', group: 'general', icon: LineChart },
  { id: 'notifications', label: 'Notifications', group: 'general', icon: Bell },
  // Platform
  { id: 'platform', label: 'Platform', group: 'platform', icon: Monitor },
]

const GROUP_LABELS: Record<string, string> = {
  agent: 'Agent',
  data: 'Data',
  general: 'General',
  platform: 'Platform',
}

const GROUPS = ['agent', 'data', 'general', 'platform'] as const

interface SettingsSidebarProps {
  activeSection: string
  onSelect: (id: string) => void
}

export function SettingsSidebar({ activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <nav className="w-48 shrink-0 border-r border-border pr-4 space-y-4" aria-label="Settings navigation">
      {GROUPS.map((group) => {
        const items = SETTINGS_SECTIONS.filter((s) => s.group === group)
        return (
          <div key={group}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2">
              {GROUP_LABELS[group]}
            </p>
            {items.map((item) => {
              const Icon = item.icon
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
