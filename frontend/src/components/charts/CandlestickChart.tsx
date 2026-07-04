import { useRef, useEffect, useCallback } from 'react'
import { useChart } from '@/hooks/useChart'
import { CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import type { ISeriesApi } from 'lightweight-charts'
import type { StockBar } from '@/types/stocks'
import { useCatalystMarkers } from '@/hooks/useCatalystMarkers'
import { CatalystMarkers } from './CatalystMarkers'
import { useSocket } from '@/hooks/useSocket'
import { usePageVisibility } from '@/hooks/usePageVisibility'

interface CandlestickChartProps {
  bars: StockBar[]
  symbol?: string | null
  enableCatalystMarkers?: boolean
  enableRealtimeUpdates?: boolean
}

export function CandlestickChart({ bars, symbol, enableCatalystMarkers, enableRealtimeUpdates }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { chart } = useChart(containerRef)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const markers = useCatalystMarkers(enableCatalystMarkers ? (symbol ?? null) : null)
  const { subscribe, unsubscribe, isConnected } = useSocket()
  const isVisible = usePageVisibility()

  useEffect(() => {
    const c = chart.current
    if (!c || bars.length === 0) return

    const candleSeries = c.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const pane = c.addPane()
    const volumeSeries = pane.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    pane.setStretchFactor(0.3)

    const candleData = bars.map((bar) => ({
      time: bar.date as string,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))

    const volumeData = bars.map((bar) => ({
      time: bar.date as string,
      value: bar.volume ?? 0,
      color: bar.close >= bar.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
    }))

    candleSeries.setData(candleData)
    volumeSeries.setData(volumeData)
    c.timeScale().fitContent()

    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    return () => {
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      try {
        c.removeSeries(candleSeries)
        c.removePane(pane.paneIndex())
      } catch {
        // Chart may already be disposed
      }
    }
  }, [chart, bars])

  // Track current bar state for proper OHLC updates
  const currentBarRef = useRef<{
    time: string
    open: number
    high: number
    low: number
    close: number
  } | null>(null)

  // Real-time bar updates via WebSocket
  const handleQuoteUpdate = useCallback((data: unknown) => {
    const update = data as { symbol: string; price: number; volume?: number; timestamp?: string }
    if (!symbol || update.symbol !== symbol) return
    if (!candleSeriesRef.current) return

    const now = new Date()
    const timeStr = now.toISOString().split('T')[0]

    // Check if we need a new bar or update existing
    if (!currentBarRef.current || currentBarRef.current.time !== timeStr) {
      // New bar
      currentBarRef.current = {
        time: timeStr,
        open: update.price,
        high: update.price,
        low: update.price,
        close: update.price,
      }
    } else {
      // Update existing bar with proper OHLC logic
      currentBarRef.current = {
        ...currentBarRef.current,
        high: Math.max(currentBarRef.current.high, update.price),
        low: Math.min(currentBarRef.current.low, update.price),
        close: update.price,
      }
    }

    candleSeriesRef.current.update(currentBarRef.current)

    if (volumeSeriesRef.current && update.volume != null) {
      volumeSeriesRef.current.update({
        time: timeStr,
        value: update.volume,
        color: currentBarRef.current.close >= currentBarRef.current.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
      })
    }
  }, [symbol])

  useEffect(() => {
    if (!enableRealtimeUpdates || !isConnected || !isVisible) return

    subscribe('quote_update', handleQuoteUpdate)
    return () => unsubscribe('quote_update', handleQuoteUpdate)
  }, [enableRealtimeUpdates, isConnected, isVisible, subscribe, unsubscribe, handleQuoteUpdate])

  return (
    <div className="relative h-full w-full min-h-[300px]">
      <div ref={containerRef} className="h-full w-full" />
      {enableCatalystMarkers && (
        <CatalystMarkers series={candleSeriesRef.current} markers={markers} />
      )}
    </div>
  )
}
