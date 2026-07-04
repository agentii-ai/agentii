import { useState, useRef, useEffect } from 'react'
import { X, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileTab } from '@/types/ide'

interface TabBarProps {
  tabs: FileTab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onTabPin?: (tabId: string) => void
  onSave?: () => void
  onCloseAll?: () => void
  onCloseOthers?: (tabId: string) => void
  onCloseSaved?: () => void
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onTabPin, onSave, onCloseAll, onCloseOthers, onCloseSaved }: TabBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  if (tabs.length === 0) return null

  return (
    <div className="flex items-center border-b border-border bg-muted/30">
      <div className="flex flex-1 items-center gap-px overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              onClick={() => onTabSelect(tab.id)}
              onDoubleClick={() => tab.isPreview && onTabPin?.(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTabSelect(tab.id) }
              }}
              className={cn(
                'group relative flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer',
                isActive && 'border-primary bg-background',
              )}
            >
              <span className={cn('max-w-[150px] truncate', tab.isPreview && 'italic')}>
                {tab.fileName}
              </span>
              {tab.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                onAuxClick={(e) => { if (e.button === 1) { e.stopPropagation(); onTabClose(tab.id) } }}
                className="ml-1 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                aria-label="Close tab"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Ellipsis dropdown menu — editing actions (CLI-agent-first: minimal, hidden) */}
      <div ref={menuRef} className="relative shrink-0 px-1">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Editor actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-md">
            {[
              { label: 'Save', shortcut: '⌘S', action: onSave },
              { label: 'Close All', action: onCloseAll },
              { label: 'Close Others', action: activeTabId ? () => onCloseOthers?.(activeTabId) : undefined },
              { label: 'Close Saved', action: onCloseSaved },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { item.action?.(); setMenuOpen(false) }}
                disabled={!item.action}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
              >
                <span>{item.label}</span>
                {item.shortcut && <span className="text-[10px] text-muted-foreground">{item.shortcut}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
