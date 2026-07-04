import type { DeepPartial, ChartOptions } from 'lightweight-charts'

type ChartTheme = DeepPartial<ChartOptions>

export const lightChartTheme: ChartTheme = {
  layout: {
    background: { color: '#ffffff' },
    textColor: '#0a0a0a',
    attributionLogo: true,
  },
  grid: {
    vertLines: { color: '#e5e5e5' },
    horzLines: { color: '#e5e5e5' },
  },
  crosshair: {
    vertLine: { color: '#a3a3a3', labelBackgroundColor: '#0a0a0a' },
    horzLine: { color: '#a3a3a3', labelBackgroundColor: '#0a0a0a' },
  },
  rightPriceScale: {
    borderColor: '#e5e5e5',
  },
  timeScale: {
    borderColor: '#e5e5e5',
  },
}

export const darkChartTheme: ChartTheme = {
  layout: {
    background: { color: '#0d1117' },
    textColor: '#e2e8f0',
    attributionLogo: true,
  },
  grid: {
    vertLines: { color: '#1e2d3d' },
    horzLines: { color: '#1e2d3d' },
  },
  crosshair: {
    vertLine: { color: '#3b82f6', labelBackgroundColor: '#131a24' },
    horzLine: { color: '#3b82f6', labelBackgroundColor: '#131a24' },
  },
  rightPriceScale: {
    borderColor: '#1e2d3d',
  },
  timeScale: {
    borderColor: '#1e2d3d',
  },
}
