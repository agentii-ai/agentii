import type { ReactNode } from 'react'
import type { SidePanelView } from '@/types/ide'

interface SidePanelProps {
  activeView: SidePanelView | null
  children: Record<string, ReactNode>
}

export function SidePanel({ activeView, children }: SidePanelProps) {
  if (!activeView) return null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-card">
      <div className="flex items-center border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {activeView}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {children[activeView] ?? (
          <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
            No content
          </div>
        )}
      </div>
    </div>
  )
}
