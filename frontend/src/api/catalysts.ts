import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { CatalystEvent, FDADecision, EquityInstrument, StockSnapshot, CatalystType } from '@/types'

export function useCatalysts(params?: {
  catalyst_type?: CatalystType
  start_date?: string
  end_date?: string
  therapeutic_area?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['catalysts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ events: CatalystEvent[] }>('/catalysts', { params })
      return data.events
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCatalystDetail(id: string | null) {
  return useQuery({
    queryKey: ['catalysts', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        event: CatalystEvent
        instrument: EquityInstrument
        snapshot: StockSnapshot | null
        chain_summary: { total_call_oi: number; total_put_oi: number; pcr: number } | null
      }>(`/catalysts/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
  })
}

export function useFDADecision(id: string | null) {
  return useQuery({
    queryKey: ['catalysts', id, 'decision'],
    queryFn: async () => {
      const { data } = await apiClient.get<FDADecision | null>(`/catalysts/${id}/decision`)
      return data
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
