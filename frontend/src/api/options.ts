import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from './client'
import type { OptionsChain, VolatilitySurface, OptionPricingResult, PayoffDiagram, PayoffLeg, OptionType, PricingModel } from '@/types'

export function useOptionsChain(symbol: string | null, params?: { expiration?: string; strike_count?: number; min_volume?: number }) {
  return useQuery({
    queryKey: ['options', symbol, params],
    queryFn: async () => {
      const { data } = await apiClient.get<OptionsChain>(`/options/${symbol}`, { params })
      return data
    },
    enabled: !!symbol,
    staleTime: 30_000,
  })
}

export function useVolatilitySurface(symbol: string | null) {
  return useQuery({
    queryKey: ['options', symbol, 'surface'],
    queryFn: async () => {
      const { data } = await apiClient.get<VolatilitySurface>(`/options/${symbol}/surface`)
      return data
    },
    enabled: !!symbol,
    staleTime: 60_000,
  })
}

export function useOptionPricing() {
  return useMutation({
    mutationFn: async (params: {
      underlying_price: number
      strike: number
      risk_free_rate: number
      time_to_expiry: number
      volatility: number
      option_type: OptionType
      pricing_model: PricingModel
    }) => {
      const { data } = await apiClient.post<OptionPricingResult>('/options/pricing', params)
      return data
    },
  })
}

export function usePayoffDiagram() {
  return useMutation({
    mutationFn: async (params: {
      legs: PayoffLeg[]
      underlying_range: [number, number]
      points: number
    }) => {
      const { data } = await apiClient.post<PayoffDiagram>('/options/payoff', params)
      return data
    },
  })
}
