import type { CryptoBar, CryptoSnapshot, CryptoQuote, CryptoTick } from '@/types'

export const mockCryptoTick: CryptoTick = {
  symbol: 'BTCUSD',
  provider: 'alpaca',
  timestamp_ns: Date.now() * 1_000_000,
  price: 45000.0,
  size: 0.5,
  exchange: 'CBOE',
  conditions: null,
}

export const mockCryptoQuote: CryptoQuote = {
  symbol: 'BTCUSD',
  provider: 'alpaca',
  timestamp_ns: Date.now() * 1_000_000,
  bid: 44995.0,
  bid_size: 1.2,
  bid_exchange: 'CBOE',
  ask: 45005.0,
  ask_size: 0.8,
  ask_exchange: 'CBOE',
  last_price: 45000.0,
  last_size: 0.5,
  volume: 1250.5,
  mid_price: 45000.0,
  spread: 10.0,
}

export const mockCryptoBar: CryptoBar = {
  symbol: 'BTCUSD',
  provider: 'alpaca',
  timestamp_ns: Date.now() * 1_000_000,
  date: '2026-03-05',
  open: 44500.0,
  high: 45500.0,
  low: 44000.0,
  close: 45000.0,
  timeframe: '1d',
  volume: 15000.5,
  vwap: 44800.0,
  trade_count: 12500,
  is_intraday: false,
}

export const mockCryptoBars: CryptoBar[] = Array.from({ length: 30 }, (_, i) => ({
  ...mockCryptoBar,
  date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  open: 44000 + Math.random() * 2000,
  high: 45000 + Math.random() * 1000,
  low: 43000 + Math.random() * 1000,
  close: 44500 + Math.random() * 1500,
}))

export const mockCryptoSnapshot: CryptoSnapshot = {
  symbol: 'BTCUSD',
  provider: 'alpaca',
  timestamp_ns: Date.now() * 1_000_000,
  quote: mockCryptoQuote,
  latest_trade: mockCryptoTick,
  daily_bar: mockCryptoBar,
  prev_daily_bar: {
    ...mockCryptoBar,
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    close: 44200.0,
  },
  minute_bar: {
    ...mockCryptoBar,
    timeframe: '1min',
    is_intraday: true,
  },
}
