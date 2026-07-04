/** Generative UI component prop types */

export interface FinancialTableProps {
  title?: string
  columns: { key: string; label: string; type: 'text' | 'number' | 'percent' | 'currency' }[]
  rows: Record<string, unknown>[]
  highlightRows?: number[]
}

export interface MiniChartProps {
  data: { time: string; value: number }[]
  type: 'line' | 'bar'
  color?: string
  height?: number
  label?: string
}

export interface CompanyCardProps {
  ticker: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap?: number
}

export interface ComparisonGridProps {
  companies: { ticker: string; name: string }[]
  metrics: { key: string; label: string; type: 'number' | 'percent' | 'currency' }[]
  data: Record<string, Record<string, unknown>>
}

export interface CatalystTimelineProps {
  events: { date: string; title: string; type: string; ticker?: string; impact?: 'high' | 'medium' | 'low' }[]
}

export interface SignalCardProps {
  ticker: string
  signal: 'buy' | 'sell' | 'hold'
  confidence: number
  reasoning: string
  price?: number
  target?: number
}

export interface ChartOverlayProps {
  label: string
  data: { time: string; value: number }[]
  color: string
  type: 'line' | 'histogram' | 'area'
}
