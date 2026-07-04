import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Order, Trade, AssetClass, Exchange, OrderSide, OrderType, TimeInForce } from '@/types'

export function useOrders(params?: { status?: string; symbol?: string; limit?: number }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ orders: Order[] }>('/orders', { params })
      return data.orders
    },
    staleTime: 10_000,
  })
}

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (order: {
      symbol: string
      asset_class: AssetClass
      exchange: Exchange
      side: OrderSide
      order_type: OrderType
      time_in_force: TimeInForce
      quantity: number
      price?: number
      stop_price?: number
      agent_id?: string
      strategy_id?: string
    }) => {
      const { data } = await apiClient.post<{ order: Order }>('/orders', order)
      return data.order
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await apiClient.delete<{ order: Order }>(`/orders/${orderId}`)
      return data.order
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useTrades(params?: { symbol?: string; start_date?: string; end_date?: string; limit?: number }) {
  return useQuery({
    queryKey: ['trades', params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ trades: Trade[] }>('/trades', { params })
      return data.trades
    },
    staleTime: 30_000,
  })
}
