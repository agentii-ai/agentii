import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from './useSocket'
import { usePageVisibility } from './usePageVisibility'
import { useMultiQuotes } from '@/api/market-data'
import type { QuoteUpdateEvent } from '@/types/events'

interface LivePriceData {
  ltp: number | null
  bid: number | null
  ask: number | null
  change: number | null
  change_percent: number | null
  isStale: boolean
  isLive: boolean
}

const STALE_THRESHOLD = 5000

export function useLivePrice(symbol: string | null): LivePriceData {
  const { isConnected, subscribe, unsubscribe, emit } = useSocket()
  const isVisible = usePageVisibility()
  const [data, setData] = useState<LivePriceData>({
    ltp: null,
    bid: null,
    ask: null,
    change: null,
    change_percent: null,
    isStale: true,
    isLive: false,
  })
  const lastUpdateRef = useRef<number>(0)
  const staleTimerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // REST fallback via multi-quotes
  const symbols = symbol ? [{ symbol, exchange: '' }] : []
  const { data: restData } = useMultiQuotes(symbols)

  // Track symbol in ref to avoid stale closures
  const symbolRef = useRef(symbol)
  useEffect(() => {
    symbolRef.current = symbol
  }, [symbol])

  // WebSocket handler - no dependencies to prevent memory leaks
  const handleQuoteUpdate = useCallback((event: unknown) => {
    const update = event as QuoteUpdateEvent
    if (update.symbol !== symbolRef.current) return
    lastUpdateRef.current = Date.now()
    setData({
      ltp: update.ltp,
      bid: update.bid,
      ask: update.ask,
      change: update.change,
      change_percent: update.change_percent,
      isStale: false,
      isLive: true,
    })
  }, [])

  // Subscribe to WebSocket
  useEffect(() => {
    if (!symbol || !isConnected || !isVisible) return

    emit('subscribe_quotes', { symbols: [{ symbol, exchange: '' }] })
    subscribe('quote_update', handleQuoteUpdate)

    return () => {
      unsubscribe('quote_update', handleQuoteUpdate)
      emit('unsubscribe_quotes', { symbols: [{ symbol, exchange: '' }] })
    }
  }, [symbol, isConnected, isVisible, emit, subscribe, unsubscribe, handleQuoteUpdate])

  // Staleness detection
  useEffect(() => {
    staleTimerRef.current = setInterval(() => {
      if (lastUpdateRef.current > 0 && Date.now() - lastUpdateRef.current > STALE_THRESHOLD) {
        setData((prev) => ({ ...prev, isStale: true }))
      }
    }, 1000)
    return () => clearInterval(staleTimerRef.current)
  }, [])

  // REST fallback
  useEffect(() => {
    if (data.isLive || !restData?.length) return
    const quote = restData.find((r) => r.symbol === symbol)?.data
    if (!quote) return
    setData((prev) => ({
      ...prev,
      ltp: quote.last_price,
      bid: quote.bid,
      ask: quote.ask,
      isStale: false,
    }))
  }, [restData, symbol, data.isLive])

  return data
}
