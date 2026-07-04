import { useState } from 'react'
import { usePortfolioLive } from '@/hooks/usePortfolio'
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary'
import { PositionsTable } from '@/components/portfolio/PositionsTable'
import { PositionDetail } from '@/components/portfolio/PositionDetail'
import { GreeksBreakdown } from '@/components/portfolio/GreeksBreakdown'
import type { StockPosition, OptionPosition } from '@/types/portfolio'

export default function PortfolioPage() {
  const { data: portfolio, isLoading } = usePortfolioLive()
  const [selectedPosition, setSelectedPosition] = useState<StockPosition | OptionPosition | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading portfolio...
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No portfolio data available
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Portfolio</h1>
        <span className="text-xs text-muted-foreground">
          Updated {new Date(portfolio.updated_at).toLocaleTimeString()}
        </span>
      </div>

      <PortfolioSummary portfolio={portfolio} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 overflow-auto">
          <PositionsTable
            stockPositions={portfolio.stock_positions}
            optionPositions={portfolio.option_positions}
            onSelectStock={setSelectedPosition}
            onSelectOption={setSelectedPosition}
          />
        </div>

        <div className="overflow-auto">
          <GreeksBreakdown optionPositions={portfolio.option_positions} />
        </div>
      </div>

      {selectedPosition && (
        <PositionDetail position={selectedPosition} onClose={() => setSelectedPosition(null)} />
      )}
    </div>
  )
}
