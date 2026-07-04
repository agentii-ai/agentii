import { useState, useEffect } from 'react'
import type { MarketSession } from '@/types/enums'
import { getMarketSession } from '@/lib/market-hours'

export function useMarketStatus() {
  const [session, setSession] = useState<MarketSession | 'closed'>(getMarketSession)

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getMarketSession())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return session
}
