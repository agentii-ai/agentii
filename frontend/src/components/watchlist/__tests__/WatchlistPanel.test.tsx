import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WatchlistPanel } from '../WatchlistPanel'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the SymbolSearch component to avoid cmdk complexity in tests
vi.mock('../SymbolSearch', () => ({
  SymbolSearch: () => <div data-testid="symbol-search">Search</div>,
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('WatchlistPanel', () => {
  beforeEach(() => {
    // Reset store to default state
    useWatchlistStore.setState({
      watchlists: [
        {
          id: 'default',
          name: 'Watchlist',
          items: [
            { symbol: 'MRNA', exchange: 'NASDAQ', name: 'Moderna Inc', asset_class: 'equity', addedAt: '2026-03-01T00:00:00Z' },
            { symbol: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc', asset_class: 'equity', addedAt: '2026-03-01T00:00:00Z' },
            { symbol: 'SPY', exchange: 'ARCA', name: 'SPDR S&P 500 ETF', asset_class: 'etf', addedAt: '2026-03-01T00:00:00Z' },
          ],
          createdAt: '2026-03-01T00:00:00Z',
          updatedAt: '2026-03-01T00:00:00Z',
        },
      ],
      selectedSymbol: 'MRNA',
    })
  })

  it('renders all watchlist symbols', () => {
    renderWithProviders(<WatchlistPanel />)
    expect(screen.getByText('MRNA')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('SPY')).toBeInTheDocument()
  })

  it('renders symbol names', () => {
    renderWithProviders(<WatchlistPanel />)
    expect(screen.getByText('Moderna Inc')).toBeInTheDocument()
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
  })

  it('highlights the selected symbol', () => {
    renderWithProviders(<WatchlistPanel />)
    const mrnaRow = screen.getByText('MRNA').closest('[role="button"]')
    expect(mrnaRow?.className).toContain('bg-accent')
  })

  it('selects a symbol on click', () => {
    renderWithProviders(<WatchlistPanel />)
    fireEvent.click(screen.getByText('AAPL'))
    expect(useWatchlistStore.getState().selectedSymbol).toBe('AAPL')
  })

  it('renders empty state when no symbols', () => {
    useWatchlistStore.setState({
      watchlists: [
        { id: 'default', name: 'Watchlist', items: [], createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
      ],
    })
    renderWithProviders(<WatchlistPanel />)
    expect(screen.getByText('No symbols. Use search to add.')).toBeInTheDocument()
  })

  it('includes the symbol search component', () => {
    renderWithProviders(<WatchlistPanel />)
    expect(screen.getByTestId('symbol-search')).toBeInTheDocument()
  })
})
