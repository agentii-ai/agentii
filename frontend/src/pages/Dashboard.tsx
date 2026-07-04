import { useState } from 'react'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { useStockBars } from '@/api/market-data'
import { WatchlistPanel } from '@/components/watchlist/WatchlistPanel'
import { CandlestickChart } from '@/components/charts/CandlestickChart'
import { TimeframeSelector } from '@/components/charts/TimeframeSelector'
import { MarketStatusBadge } from '@/components/trading/MarketStatusBadge'
import { PaperTradeBadge } from '@/components/trading/PaperTradeBadge'
import type { BarTimeframe } from '@/types/enums'

export default function Dashboard() {
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol)
  const [timeframe, setTimeframe] = useState<BarTimeframe>('1d')
  const { data: bars = [], isLoading } = useStockBars(selectedSymbol, timeframe)

  return (
    <div className="flex h-full">
      <WatchlistPanel />
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{selectedSymbol || 'Dashboard'}</h1>
            <MarketStatusBadge />
            <PaperTradeBadge />
          </div>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading chart...
          </div>
        ) : bars.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            No data available for {selectedSymbol}
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <CandlestickChart
              bars={bars}
              symbol={selectedSymbol ?? undefined}
              enableRealtimeUpdates
              enableCatalystMarkers
            />
          </div>
        )}
      </div>
    </div>
  )
}
