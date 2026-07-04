import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Portfolio, StockPosition, OptionPosition } from '@/types'

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const { data } = await apiClient.get<Portfolio>('/portfolio')
      return data
    },
    staleTime: 30_000,
  })
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        stock_positions: StockPosition[]
        option_positions: OptionPosition[]
      }>('/positions')
      return data
    },
    staleTime: 30_000,
  })
}
