import { useState, useCallback } from 'react'
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command'
import { useInstrumentSearch } from '@/api/instruments'
import { useWatchlistStore } from '@/stores/watchlistStore'
import type { WatchlistItem } from '@/types/watchlist'
import type { Exchange, AssetClass } from '@/types/enums'

export function SymbolSearch() {
  const [query, setQuery] = useState('')
  const { data: results } = useInstrumentSearch(query)
  const { addSymbol, watchlists, setSelected } = useWatchlistStore()

  const handleSelect = useCallback(
    (symbol: string, name: string, exchange: string, assetClass: string) => {
      const item: WatchlistItem = {
        symbol,
        exchange: exchange as Exchange,
        name,
        asset_class: assetClass as AssetClass,
        addedAt: new Date().toISOString(),
      }
      if (watchlists[0]) {
        addSymbol(watchlists[0].id, item)
      }
      setSelected(symbol)
      setQuery('')
    },
    [addSymbol, watchlists, setSelected],
  )

  return (
    <Command className="rounded-md border-0" shouldFilter={false}>
      <CommandInput
        placeholder="Search symbols..."
        value={query}
        onValueChange={setQuery}
        className="h-8 text-xs"
      />
      {query.length > 0 && (
        <CommandList className="max-h-[200px]">
          <CommandEmpty>No symbols found.</CommandEmpty>
          {results?.map((r) => (
            <CommandItem
              key={r.symbol}
              onSelect={() => handleSelect(r.symbol, r.name, r.exchange, r.asset_class)}
              className="text-xs"
            >
              <span className="font-medium">{r.symbol}</span>
              <span className="ml-2 text-muted-foreground truncate">{r.name}</span>
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  )
}
