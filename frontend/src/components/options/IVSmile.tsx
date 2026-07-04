import { useRef, useEffect, useMemo } from 'react'
import { useChart } from '@/hooks/useChart'
import { LineSeries } from 'lightweight-charts'
import type { OptionQuote } from '@/types/options'

interface IVSmileProps {
  calls: OptionQuote[]
  puts: OptionQuote[]
  atmStrike?: number | null
}

export function IVSmile({ calls, puts, atmStrike }: IVSmileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { chart } = useChart(containerRef, {
    options: {
      rightPriceScale: { autoScale: true },
    },
  })

  const { callIV, putIV } = useMemo(() => {
    const mapIV = (contracts: OptionQuote[]) =>
      [...contracts]
        .filter((c) => c.implied_volatility != null)
        .sort((a, b) => a.strike - b.strike)
        .map((c) => ({
          time: c.strike as unknown as string,
          value: c.implied_volatility! * 100,
        }))

    return { callIV: mapIV(calls), putIV: mapIV(puts) }
  }, [calls, puts])

  useEffect(() => {
    const c = chart.current
    if (!c || (callIV.length === 0 && putIV.length === 0)) return

    const callSeries = c.addSeries(LineSeries, {
      color: '#22c55e',
      lineWidth: 2,
      title: 'Call IV',
    })
    const putSeries = c.addSeries(LineSeries, {
      color: '#ef4444',
      lineWidth: 2,
      title: 'Put IV',
    })

    callSeries.setData(callIV)
    putSeries.setData(putIV)
    c.timeScale().fitContent()

    return () => {
      try {
        c.removeSeries(callSeries)
        c.removeSeries(putSeries)
      } catch { /* chart may be disposed */ }
    }
  }, [chart, callIV, putIV, atmStrike])

  if (callIV.length === 0 && putIV.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        No IV data available
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full min-h-[400px]" />
}
