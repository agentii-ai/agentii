import { useThemeStore } from '@/stores/themeStore'
import { useVolatilitySurface } from '@/api/options'
import { PlotlyLazy } from './PlotlyLazy'
import { useMemo } from 'react'

interface IVSurfaceProps {
  symbol: string
}

export function IVSurface({ symbol }: IVSurfaceProps) {
  const { data: surface, isLoading } = useVolatilitySurface(symbol)
  const theme = useThemeStore((s) => s.theme)

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const { plotData, plotLayout } = useMemo(() => {
    if (!surface || surface.points.length === 0) {
      return { plotData: [], plotLayout: {} }
    }

    const strikes = [...new Set(surface.points.map((p) => p.strike))].sort((a, b) => a - b)
    const expirations = [...new Set(surface.points.map((p) => p.expiration))].sort()

    const z: number[][] = expirations.map((exp) =>
      strikes.map((strike) => {
        const point = surface.points.find((p) => p.strike === strike && p.expiration === exp)
        return point ? point.implied_volatility * 100 : 0
      }),
    )

    const data: Plotly.Data[] = [
      {
        type: 'surface' as const,
        x: strikes,
        y: expirations,
        z,
        colorscale: 'Viridis',
        hovertemplate: 'Strike: %{x}<br>Expiry: %{y}<br>IV: %{z:.1f}%<extra></extra>',
      },
    ]

    const layout: Partial<Plotly.Layout> = {
      scene: {
        xaxis: { title: { text: 'Strike' } },
        yaxis: { title: { text: 'Expiration' } },
        zaxis: { title: { text: 'IV (%)' } },
        bgcolor: isDark ? '#0d1117' : '#ffffff',
      },
      paper_bgcolor: isDark ? '#0d1117' : '#ffffff',
      font: { color: isDark ? '#e2e8f0' : '#0a0a0a' },
      margin: { l: 0, r: 0, t: 30, b: 0 },
    }

    return { plotData: data, plotLayout: layout }
  }, [surface, isDark])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Loading IV surface...
      </div>
    )
  }

  if (!surface || surface.points.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        No IV surface data available
      </div>
    )
  }

  return (
    <div className="h-full w-full min-h-[400px]">
      <PlotlyLazy data={plotData} layout={plotLayout} />
    </div>
  )
}
