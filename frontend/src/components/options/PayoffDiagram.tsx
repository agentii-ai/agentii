import { useRef, useEffect, useMemo } from 'react'
import { useChart } from '@/hooks/useChart'
import { BaselineSeries } from 'lightweight-charts'
import type { PayoffDiagram as PayoffDiagramType } from '@/types/analytics'

interface PayoffDiagramProps {
  diagram: PayoffDiagramType | null
  isLoading?: boolean
}

export function PayoffDiagram({ diagram, isLoading }: PayoffDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { chart } = useChart(containerRef, {
    options: {
      rightPriceScale: { autoScale: true },
    },
  })

  const chartData = useMemo(() => {
    if (!diagram) return []
    return diagram.points
      .sort((a, b) => a.underlying_price - b.underlying_price)
      .map((p) => ({
        time: p.underlying_price as unknown as string,
        value: p.profit_loss,
      }))
  }, [diagram])

  useEffect(() => {
    const c = chart.current
    if (!c || chartData.length === 0) return

    const series = c.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topFillColor1: 'rgba(34, 197, 94, 0.3)',
      topFillColor2: 'rgba(34, 197, 94, 0.05)',
      topLineColor: '#22c55e',
      bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
      bottomFillColor2: 'rgba(239, 68, 68, 0.3)',
      bottomLineColor: '#ef4444',
      lineWidth: 2,
    })

    series.setData(chartData)
    c.timeScale().fitContent()

    return () => {
      try {
        c.removeSeries(series)
      } catch { /* chart may be disposed */ }
    }
  }, [chart, chartData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Calculating payoff...
      </div>
    )
  }

  if (!diagram || diagram.points.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        No payoff data. Select a strategy to view the P&L diagram.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-2 py-1 text-xs text-muted-foreground">
        <span>{diagram.strategy_name}</span>
        {diagram.breakeven_points.length > 0 && (
          <span>Breakeven: {diagram.breakeven_points.map((b) => `$${b.toFixed(2)}`).join(', ')}</span>
        )}
        {diagram.max_profit != null && <span>Max Profit: ${diagram.max_profit.toFixed(0)}</span>}
        {diagram.max_loss != null && <span>Max Loss: ${diagram.max_loss.toFixed(0)}</span>}
      </div>
      <div ref={containerRef} className="flex-1 min-h-[350px]" />
    </div>
  )
}
