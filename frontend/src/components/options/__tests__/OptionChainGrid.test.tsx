import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionChainGrid } from '../OptionChainGrid'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { generateOptionsChain } from '@/test/fixtures/options'

const mockChain = generateOptionsChain('MRNA', 42)

vi.mock('@/api/options', () => ({
  useOptionsChain: vi.fn(() => ({
    data: mockChain,
    isLoading: false,
    isError: false,
  })),
  useVolatilitySurface: vi.fn(() => ({ data: null, isLoading: false })),
  useOptionPricing: vi.fn(() => ({ mutate: vi.fn() })),
  usePayoffDiagram: vi.fn(() => ({ mutate: vi.fn() })),
}))

vi.mock('lightweight-charts', () => {
  const mockSeries = { setData: vi.fn(), update: vi.fn() }
  const mockPane = { addSeries: vi.fn(() => mockSeries), setStretchFactor: vi.fn(), paneIndex: vi.fn(() => 1) }
  const mockTimeScale = { fitContent: vi.fn() }
  const mockChart = {
    addSeries: vi.fn(() => mockSeries),
    addPane: vi.fn(() => mockPane),
    removeSeries: vi.fn(),
    removePane: vi.fn(),
    timeScale: vi.fn(() => mockTimeScale),
    resize: vi.fn(),
    remove: vi.fn(),
    applyOptions: vi.fn(),
  }
  return {
    createChart: vi.fn(() => mockChart),
    CandlestickSeries: 'CandlestickSeries',
    HistogramSeries: 'HistogramSeries',
    LineSeries: 'LineSeries',
    BaselineSeries: 'BaselineSeries',
  }
})

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('OptionChainGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).ResizeObserver = class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver
  })

  it('renders the chain with strike rows', () => {
    renderWithProviders(<OptionChainGrid symbol="MRNA" />)
    expect(screen.getByText('CALLS')).toBeInTheDocument()
    expect(screen.getByText('PUTS')).toBeInTheDocument()
    expect(screen.getByText('Strike')).toBeInTheDocument()
  })

  it('renders expiration tabs', () => {
    renderWithProviders(<OptionChainGrid symbol="MRNA" />)
    // Should have at least one expiration tab
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)
  })

  it('renders strike count selector', () => {
    renderWithProviders(<OptionChainGrid symbol="MRNA" />)
    expect(screen.getByLabelText('Strike count')).toBeInTheDocument()
  })
})
