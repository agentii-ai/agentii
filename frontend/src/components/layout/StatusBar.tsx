import { Link2, Link2Off } from 'lucide-react'

interface StatusBarProps {
  isLinked: boolean
  linkedTicker: string | null
  onUnlink?: () => void
}

export function StatusBar({ isLinked, linkedTicker, onUnlink }: StatusBarProps) {
  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-muted/30 px-3 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Agentii IDE</span>
      </div>
      <div className="flex items-center gap-2">
        {isLinked && linkedTicker && (
          <button
            type="button"
            onClick={onUnlink}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent transition-colors"
          >
            <Link2 className="h-3 w-3 text-blue-400" />
            <span className="text-blue-400">{linkedTicker}</span>
          </button>
        )}
        {!isLinked && (
          <span className="flex items-center gap-1">
            <Link2Off className="h-3 w-3" />
            Not linked
          </span>
        )}
      </div>
    </div>
  )
}
