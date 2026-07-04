import type { StockBar, StockSnapshot, StockQuote } from '@/types/stocks'

function generateBars(symbol: string, count: number): StockBar[] {
  const bars: StockBar[] = []
  const now = new Date()
  let price = symbol === 'MRNA' ? 42 : symbol === 'AAPL' ? 195 : symbol === 'SPY' ? 520 : symbol === 'NVDA' ? 880 : 110

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    if (date.getDay() === 0 || date.getDay() === 6) continue

    const change = (Math.random() - 0.48) * price * 0.03
    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.random() * price * 0.01
    const low = Math.min(open, close) - Math.random() * price * 0.01
    price = close

    bars.push({
      symbol,
      provider: 'mock',
      timestamp_ns: null,
      date: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      timeframe: '1d',
      volume: Math.floor(Math.random() * 20_000_000) + 1_000_000,
      vwap: +((open + close) / 2).toFixed(2),
      trade_count: Math.floor(Math.random() * 50000) + 5000,
      session: 'regular',
      is_intraday: false,
    })
  }
  return bars
}

export const mrnaBars = generateBars('MRNA', 365)
export const aaplBars = generateBars('AAPL', 365)
export const spyBars = generateBars('SPY', 365)
export const nvdaBars = generateBars('NVDA', 365)
export const bntxBars = generateBars('BNTX', 365)

const barsMap: Record<string, StockBar[]> = {
  MRNA: mrnaBars,
  AAPL: aaplBars,
  SPY: spyBars,
  NVDA: nvdaBars,
  BNTX: bntxBars,
}

export function getBarsForSymbol(symbol: string): StockBar[] {
  return barsMap[symbol] ?? generateBars(symbol, 365)
}

function latestBar(bars: StockBar[]): StockBar | null {
  return bars.length > 0 ? bars[bars.length - 1] : null
}

export function getSnapshotForSymbol(symbol: string): StockSnapshot {
  const bars = getBarsForSymbol(symbol)
  const latest = latestBar(bars)
  const prev = bars.length > 1 ? bars[bars.length - 2] : null

  const quote: StockQuote = {
    symbol,
    provider: 'mock',
    timestamp_ns: null,
    bid: latest ? +(latest.close - 0.01).toFixed(2) : null,
    bid_size: 100,
    bid_exchange: 'NASDAQ',
    ask: latest ? +(latest.close + 0.01).toFixed(2) : null,
    ask_size: 100,
    ask_exchange: 'NASDAQ',
    last_price: latest?.close ?? null,
    last_size: 100,
    volume: latest?.volume ?? null,
    mid_price: latest?.close ?? null,
    spread: 0.02,
  }

  return {
    symbol,
    provider: 'mock',
    timestamp_ns: null,
    quote,
    latest_trade: null,
    daily_bar: latest,
    prev_daily_bar: prev,
    minute_bar: null,
  }
}
