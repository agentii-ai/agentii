import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { EquityInstrument, OptionInstrument } from '@/types'

export function useInstrumentSearch(query: string) {
  return useQuery({
    queryKey: ['instruments', 'search', query],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        results: (EquityInstrument | OptionInstrument)[]
      }>('/instruments/search', { params: { q: query, limit: 20 } })
      return data.results
    },
    enabled: query.length >= 1,
    staleTime: 5 * 60 * 1000,
  })
}

export function useInstrument(symbol: string | null) {
  return useQuery({
    queryKey: ['instruments', symbol],
    queryFn: async () => {
      const { data } = await apiClient.get<EquityInstrument | OptionInstrument>(
        `/instruments/${symbol}`,
      )
      return data
    },
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  })
}
