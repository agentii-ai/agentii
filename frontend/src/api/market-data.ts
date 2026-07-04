import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { StockBar, StockSnapshot, StockQuote, BarTimeframe } from '@/types'

export function useStockBars(symbol: string | null, timeframe: BarTimeframe = '1d') {
  return useQuery({
    queryKey: ['bars', symbol, timeframe],
    queryFn: async () => {
      const { data } = await apiClient.get<{ bars: StockBar[] }>(`/bars/${symbol}`, {
        params: { timeframe, limit: 365 },
      })
      return data.bars
    },
    enabled: !!symbol,
    staleTime: timeframe === '1d' ? 60 * 60 * 1000 : 60 * 1000,
  })
}

export function useStockSnapshot(symbol: string | null) {
  return useQuery({
    queryKey: ['snapshot', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<StockSnapshot>(`/quotes/${symbol}`)
      return data
    },
    enabled: !!symbol,
    staleTime: 30_000,
  })
}

export function useMultiQuotes(symbols: { symbol: string; exchange: string }[]) {
  return useQuery({
    queryKey: ['multi-quotes', symbols.map((s) => s.symbol).join(',')],
    queryFn: async () => {
      const { data } = await apiClient.post<{
        results: { symbol: string; exchange: string; data: StockQuote }[]
      }>('/quotes/multi', { symbols })
      return data.results
    },
    enabled: symbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
