import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { CryptoBar, CryptoSnapshot, BarTimeframe } from '@/types'

export function useCryptoBars(symbol: string | null, timeframe: BarTimeframe = '1d') {
  return useQuery({
    queryKey: ['crypto-bars', symbol, timeframe],
    queryFn: async () => {
      const { data } = await apiClient.get<{ bars: CryptoBar[] }>(`/crypto/bars/${symbol}`, {
        params: { timeframe, limit: 365 },
      })
      return data.bars
    },
    enabled: !!symbol,
    staleTime: timeframe === '1d' ? 60 * 60 * 1000 : 60 * 1000,
  })
}

export function useCryptoSnapshot(symbol: string | null) {
  return useQuery({
    queryKey: ['crypto-snapshot', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<CryptoSnapshot>(`/crypto/quotes/${symbol}`)
      return data
    },
    enabled: !!symbol,
    staleTime: 30_000,
  })
}

export function useMultiCryptoQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ['multi-crypto-quotes', symbols.join(',')],
    queryFn: async () => {
      const { data } = await apiClient.post<{
        results: { symbol: string; data: CryptoSnapshot }[]
      }>('/crypto/quotes/multi', { symbols })
      return data.results
    },
    enabled: symbols.length > 0,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
