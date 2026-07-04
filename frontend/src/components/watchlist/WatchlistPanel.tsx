import { useWatchlistStore } from '@/stores/watchlistStore'
import { cn } from '@/lib/utils'
import { SymbolSearch } from './SymbolSearch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WatchlistPanel() {
  const { watchlists, selectedSymbol, setSelected, removeSymbol } = useWatchlistStore()
  const defaultWatchlist = watchlists[0]

  if (!defaultWatchlist) return null

  return (
    <div className="flex h-full w-[220px] flex-col border-r border-border">
      <div className="border-b border-border p-2">
        <SymbolSearch />
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {defaultWatchlist.items.map((item) => (
            <div
              key={item.symbol}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(item.symbol)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(item.symbol) }}
              className={cn(
                'group flex items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent cursor-pointer',
                selectedSymbol === item.symbol && 'bg-accent',
              )}
            >
              <div>
                <div className="font-medium">{item.symbol}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[140px]">{item.name}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  removeSymbol(defaultWatchlist.id, item.symbol)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {defaultWatchlist.items.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No symbols. Use search to add.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
