import { useRef, useEffect, useMemo } from 'react'
import { useChart } from '@/hooks/useChart'
import { LineSeries } from 'lightweight-charts'
import type { OptionQuote } from '@/types/options'

interface GreeksChartProps {
  calls: OptionQuote[]
  puts: OptionQuote[]
}

export function GreeksChart({ calls, puts }: GreeksChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { chart } = useChart(containerRef, {
    options: {
      rightPriceScale: { autoScale: true },
      handleScale: { axisPressedMouseMove: { price: true, time: true } },
    },
  })

  const { callData, putData } = useMemo(() => {
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike)
    const sortedPuts = [...puts].sort((a, b) => a.strike - b.strike)

    const mapGreek = (contracts: OptionQuote[], greek: 'delta' | 'gamma' | 'theta' | 'vega') =>
      contracts
        .filter((c) => c[greek] != null)
        .map((c) => ({ time: c.strike as unknown as string, value: c[greek]! }))

    return {
      callData: {
        delta: mapGreek(sortedCalls, 'delta'),
        gamma: mapGreek(sortedCalls, 'gamma'),
        theta: mapGreek(sortedCalls, 'theta'),
        vega: mapGreek(sortedCalls, 'vega'),
      },
      putData: {
        delta: mapGreek(sortedPuts, 'delta'),
        gamma: mapGreek(sortedPuts, 'gamma'),
        theta: mapGreek(sortedPuts, 'theta'),
        vega: mapGreek(sortedPuts, 'vega'),
      },
    }
  }, [calls, puts])

  useEffect(() => {
    const c = chart.current
    if (!c || calls.length === 0) return

    const callDelta = c.addSeries(LineSeries, { color: '#22c55e', lineWidth: 2, title: 'Call Δ' })
    const putDelta = c.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2, title: 'Put Δ' })
    const callGamma = c.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, lineStyle: 2, title: 'Call Γ' })
    const putGamma = c.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2, title: 'Put Γ' })

    callDelta.setData(callData.delta)
    putDelta.setData(putData.delta)
    callGamma.setData(callData.gamma)
    putGamma.setData(putData.gamma)

    c.timeScale().fitContent()

    return () => {
      try {
        c.removeSeries(callDelta)
        c.removeSeries(putDelta)
        c.removeSeries(callGamma)
        c.removeSeries(putGamma)
      } catch { /* chart may be disposed */ }
    }
  }, [chart, callData, putData, calls.length])

  if (calls.length === 0 && puts.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        No Greeks data available
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full min-h-[400px]" />
}
