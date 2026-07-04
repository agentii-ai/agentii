import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { CandlestickChart } from '../CandlestickChart'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { StockBar } from '@/types/stocks'

// Mock lightweight-charts since it requires a real DOM canvas
vi.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: vi.fn(),
    update: vi.fn(),
    setMarkers: vi.fn(),
  }
  const mockPane = {
    addSeries: vi.fn(() => mockSeries),
    setStretchFactor: vi.fn(),
    paneIndex: vi.fn(() => 1),
  }
  const mockTimeScale = {
    fitContent: vi.fn(),
  }
  const mockChart = {
    addSeries: vi.fn(() => mockSeries),
    addPane: vi.fn(() => mockPane),
    removeSeries: vi.fn(),
    removePane: vi.fn(),
    timeScale: vi.fn(() => mockTimeScale),
    resize: vi.fn(),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
  }
  return {
    createChart: vi.fn(() => mockChart),
    CandlestickSeries: 'CandlestickSeries',
    HistogramSeries: 'HistogramSeries',
    LineSeries: 'LineSeries',
    AreaSeries: 'AreaSeries',
    BaselineSeries: 'BaselineSeries',
    BarSeries: 'BarSeries',
  }
})

vi.mock('@/api/catalysts', () => ({
  useCatalysts: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('@/hooks/useSocket', () => ({
  useSocket: vi.fn(() => ({
    isConnected: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    emit: vi.fn(),
  })),
}))

const sampleBars: StockBar[] = [
  { symbol: 'MRNA', provider: 'mock', timestamp_ns: null, date: '2026-01-02', open: 40, high: 42, low: 39, close: 41, timeframe: '1d', volume: 5000000, vwap: 40.5, trade_count: 10000, session: 'regular', is_intraday: false },
  { symbol: 'MRNA', provider: 'mock', timestamp_ns: null, date: '2026-01-03', open: 41, high: 43, low: 40, close: 42, timeframe: '1d', volume: 6000000, vwap: 41.5, trade_count: 12000, session: 'regular', is_intraday: false },
  { symbol: 'MRNA', provider: 'mock', timestamp_ns: null, date: '2026-01-05', open: 42, high: 44, low: 41, close: 43, timeframe: '1d', volume: 4500000, vwap: 42.5, trade_count: 9000, session: 'regular', is_intraday: false },
]

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('CandlestickChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).ResizeObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver
  })

  it('renders without error with data', () => {
    const { container } = renderWithProviders(<CandlestickChart bars={sampleBars} />)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('renders without error with empty data', () => {
    const { container } = renderWithProviders(<CandlestickChart bars={[]} />)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('renders the chart container with correct classes', () => {
    const { container } = renderWithProviders(<CandlestickChart bars={sampleBars} />)
    const chartDiv = container.firstElementChild
    expect(chartDiv?.className).toContain('h-full')
    expect(chartDiv?.className).toContain('w-full')
  })

  it('accepts StockBar[] data prop', () => {
    expect(() => renderWithProviders(<CandlestickChart bars={sampleBars} />)).not.toThrow()
  })

  it('accepts enableCatalystMarkers prop', () => {
    expect(() =>
      renderWithProviders(<CandlestickChart bars={sampleBars} enableCatalystMarkers />),
    ).not.toThrow()
  })

  it('accepts symbol and enableRealtimeUpdates props', () => {
    expect(() =>
      renderWithProviders(<CandlestickChart bars={sampleBars} symbol="MRNA" enableRealtimeUpdates />),
    ).not.toThrow()
  })
})
