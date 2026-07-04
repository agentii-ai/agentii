import { useEffect, useRef, useCallback } from 'react'
import { createChart, type IChartApi, type DeepPartial, type ChartOptions } from 'lightweight-charts'
import { lightChartTheme, darkChartTheme } from '@/config/chart-theme'
import { useThemeStore } from '@/stores/themeStore'

interface UseChartOptions {
  options?: DeepPartial<ChartOptions>
  autoResize?: boolean
}

export function useChart(containerRef: React.RefObject<HTMLDivElement | null>, opts?: UseChartOptions) {
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useThemeStore((s) => s.theme)

  const getResolvedTheme = useCallback(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }, [theme])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resolved = getResolvedTheme()
    const themeOptions = resolved === 'dark' ? darkChartTheme : lightChartTheme

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      ...themeOptions,
      ...opts?.options,
    })

    chartRef.current = chart

    // Auto-resize via ResizeObserver
    let observer: ResizeObserver | undefined
    if (opts?.autoResize !== false) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0) {
            chart.resize(width, height)
          }
        }
      })
      observer.observe(container)
    }

    return () => {
      observer?.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [containerRef, getResolvedTheme, opts?.options, opts?.autoResize])

  // Sync theme changes
  useEffect(() => {
    if (!chartRef.current) return
    const resolved = getResolvedTheme()
    const themeOptions = resolved === 'dark' ? darkChartTheme : lightChartTheme
    chartRef.current.applyOptions(themeOptions)
  }, [theme, getResolvedTheme])

  return { chart: chartRef }
}
