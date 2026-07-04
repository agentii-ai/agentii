import { useLayoutStore } from '@/stores/layoutStore'
import { AgentChatPanel } from '@/components/agent/AgentChatPanel'

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function ChatPanel() {
  const toggleTerminalPanel = useLayoutStore((s) => s.toggleTerminalPanel)

  return (
    <aside className="flex h-full w-[360px] flex-col border-l border-border bg-card">
      <AgentChatPanel onCollapse={toggleTerminalPanel} />
    </aside>
  )
}
