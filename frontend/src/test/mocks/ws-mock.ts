import type { QuoteUpdateEvent } from '@/types/events'

/**
 * Simulated WebSocket mock for development.
 * In a real setup, this would use MSW's WebSocket interception.
 * For now, it provides a simple event emitter pattern.
 */
type EventHandler = (data: QuoteUpdateEvent) => void

const subscribers = new Map<string, Set<EventHandler>>()
let intervalId: ReturnType<typeof setInterval> | null = null

const mockSymbols = ['MRNA', 'AAPL', 'SPY', 'NVDA', 'BNTX']
const basePrices: Record<string, number> = { MRNA: 42, AAPL: 195, SPY: 520, NVDA: 880, BNTX: 112 }

function generateQuoteUpdate(symbol: string): QuoteUpdateEvent {
  const base = basePrices[symbol] ?? 100
  const change = (Math.random() - 0.5) * base * 0.002
  basePrices[symbol] = base + change
  const ltp = +(base + change).toFixed(2)

  return {
    symbol,
    exchange: 'NASDAQ',
    ltp,
    bid: +(ltp - 0.01).toFixed(2),
    ask: +(ltp + 0.01).toFixed(2),
    volume: Math.floor(Math.random() * 100000),
    change: +change.toFixed(2),
    change_percent: +((change / base) * 100).toFixed(2),
    timestamp: new Date().toISOString(),
  }
}

export function startMockWS() {
  if (intervalId) return

  intervalId = setInterval(() => {
    for (const symbol of mockSymbols) {
      const handlers = subscribers.get(symbol)
      if (handlers && handlers.size > 0) {
        const update = generateQuoteUpdate(symbol)
        for (const handler of handlers) {
          handler(update)
        }
      }
    }
  }, 1000)
}

export function stopMockWS() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function subscribeQuote(symbol: string, handler: EventHandler) {
  if (!subscribers.has(symbol)) subscribers.set(symbol, new Set())
  subscribers.get(symbol)!.add(handler)
}

export function unsubscribeQuote(symbol: string, handler: EventHandler) {
  subscribers.get(symbol)?.delete(handler)
}
