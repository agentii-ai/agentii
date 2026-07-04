import { useMemo } from 'react'
import { useOptionsChain } from '@/api/options'
import { useOptionChainStore } from '@/stores/optionChainStore'
import type { OptionQuote } from '@/types/options'

interface UseOptionChainReturn {
  contracts: OptionQuote[]
  calls: OptionQuote[]
  puts: OptionQuote[]
  expirations: string[]
  atmStrike: number | null
  strikeRange: number[]
  isLoading: boolean
  isError: boolean
}

export function useOptionChain(symbol: string | null, underlyingPrice?: number): UseOptionChainReturn {
  const { selectedExpiration, strikeCount } = useOptionChainStore()
  const { data: chain, isLoading, isError } = useOptionsChain(symbol)

  return useMemo(() => {
    if (!chain || chain.contracts.length === 0) {
      return {
        contracts: [],
        calls: [],
        puts: [],
        expirations: [],
        atmStrike: null,
        strikeRange: [],
        isLoading,
        isError,
      }
    }

    // Extract unique expirations sorted ascending
    const expirations = [...new Set(chain.contracts.map((c) => c.expiration))].sort()

    // Filter by selected expiration
    const expFilter = selectedExpiration || expirations[0] || null
    const filtered = expFilter
      ? chain.contracts.filter((c) => c.expiration === expFilter)
      : chain.contracts

    // Compute ATM strike (closest to underlying price)
    const price = underlyingPrice ?? (filtered[0]?.strike || 0)
    const strikes = [...new Set(filtered.map((c) => c.strike))].sort((a, b) => a - b)
    const atmStrike = strikes.reduce(
      (closest, s) => (Math.abs(s - price) < Math.abs(closest - price) ? s : closest),
      strikes[0] ?? 0,
    )

    // Filter to ±strikeCount from ATM
    const atmIndex = strikes.indexOf(atmStrike)
    const startIdx = Math.max(0, atmIndex - strikeCount)
    const endIdx = Math.min(strikes.length - 1, atmIndex + strikeCount)
    const visibleStrikes = strikes.slice(startIdx, endIdx + 1)

    const visibleContracts = filtered.filter((c) => visibleStrikes.includes(c.strike))
    const calls = visibleContracts.filter((c) => c.option_type === 'call').sort((a, b) => a.strike - b.strike)
    const puts = visibleContracts.filter((c) => c.option_type === 'put').sort((a, b) => a.strike - b.strike)

    return {
      contracts: visibleContracts,
      calls,
      puts,
      expirations,
      atmStrike,
      strikeRange: visibleStrikes,
      isLoading,
      isError,
    }
  }, [chain, selectedExpiration, strikeCount, underlyingPrice, isLoading, isError])
}
