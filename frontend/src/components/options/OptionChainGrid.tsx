import { useState } from 'react'
import { useOptionChain } from '@/hooks/useOptionChain'
import { useOptionChainStore } from '@/stores/optionChainStore'
import { OptionChainHeader } from './OptionChainHeader'
import { OptionChainRow } from './OptionChainRow'
import { OptionDetail } from './OptionDetail'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OptionQuote } from '@/types/options'

interface OptionChainGridProps {
  symbol: string
  underlyingPrice?: number
}

export function OptionChainGrid({ symbol, underlyingPrice }: OptionChainGridProps) {
  const { calls, puts, expirations, atmStrike, strikeRange, isLoading, isError } = useOptionChain(symbol, underlyingPrice)
  const { visibleColumns, selectedExpiration, setSelectedExpiration } = useOptionChainStore()
  const [selectedContract, setSelectedContract] = useState<OptionQuote | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Loading options chain...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Failed to load options chain.
      </div>
    )
  }

  if (strikeRange.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <OptionChainHeader
          expirations={expirations}
          selectedExpiration={selectedExpiration}
          onExpirationChange={setSelectedExpiration}
        />
        <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
          No options available for {symbol}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <OptionChainHeader
        expirations={expirations}
        selectedExpiration={selectedExpiration}
        onExpirationChange={setSelectedExpiration}
      />

      {/* Column headers */}
      <div
        className="grid items-center border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
      >
        <div className="px-2 py-1.5 text-center text-green-600 dark:text-green-400">CALLS</div>
        <div className="px-3 py-1.5 text-center border-x border-border/50 min-w-[70px]">Strike</div>
        <div className="px-2 py-1.5 text-center text-red-600 dark:text-red-400">PUTS</div>
      </div>

      {/* Rows */}
      <ScrollArea className="flex-1">
        {strikeRange.map((strike) => {
          const call = calls.find((c) => c.strike === strike)
          const put = puts.find((c) => c.strike === strike)
          return (
            <OptionChainRow
              key={strike}
              strike={strike}
              call={call}
              put={put}
              isATM={strike === atmStrike}
              visibleColumns={visibleColumns}
              onSelect={setSelectedContract}
            />
          )
        })}
      </ScrollArea>

      {/* Detail panel */}
      {selectedContract && (
        <OptionDetail
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </div>
  )
}
