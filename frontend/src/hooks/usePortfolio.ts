import { usePortfolio as usePortfolioAPI } from '@/api/portfolio'
import { useSocket } from '@/hooks/useSocket'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { Greeks } from '@/types'

export function usePortfolioLive() {
  const query = usePortfolioAPI()
  const { subscribe, unsubscribe, isConnected } = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isConnected) return

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
    }

    subscribe('position_update', handler)
    return () => unsubscribe('position_update', handler)
  }, [isConnected, subscribe, unsubscribe, queryClient])

  // Compute net Greeks client-side as fallback
  const portfolioWithComputedGreeks = useMemo(() => {
    if (!query.data) return null

    // If API already provided net_greeks, use it
    if (query.data.net_greeks && query.data.net_greeks.is_complete) {
      return query.data
    }

    // Otherwise compute from positions
    const netGreeks: Greeks = query.data.option_positions.reduce(
      (acc, pos) => ({
        delta: acc.delta + pos.position_greeks.delta,
        gamma: acc.gamma + pos.position_greeks.gamma,
        theta: acc.theta + pos.position_greeks.theta,
        vega: acc.vega + pos.position_greeks.vega,
        rho: acc.rho + pos.position_greeks.rho,
        implied_volatility: 0, // Not aggregated
        is_complete: true,
      }),
      { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, implied_volatility: 0, is_complete: true },
    )

    // Add stock delta (100 shares = 1.0 delta per share)
    query.data.stock_positions.forEach((pos) => {
      netGreeks.delta += pos.quantity / 100
    })

    return {
      ...query.data,
      net_greeks: netGreeks,
    }
  }, [query.data])

  return { ...query, data: portfolioWithComputedGreeks }
}
