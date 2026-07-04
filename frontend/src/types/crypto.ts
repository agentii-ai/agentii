import type { BarTimeframe, Exchange } from './enums'

export interface CryptoTick {
  symbol: string
  provider: string
  timestamp_ns: number | null
  price: number
  size: number
  exchange: Exchange | null
  conditions: string[] | null
}

export interface CryptoQuote {
  symbol: string
  provider: string
  timestamp_ns: number | null
  bid: number | null
  bid_size: number | null
  bid_exchange: Exchange | null
  ask: number | null
  ask_size: number | null
  ask_exchange: Exchange | null
  last_price: number | null
  last_size: number | null
  volume: number | null
  mid_price: number | null
  spread: number | null
}

export interface CryptoBar {
  symbol: string
  provider: string
  timestamp_ns: number | null
  date: string
  open: number
  high: number
  low: number
  close: number
  timeframe: BarTimeframe
  volume: number | null
  vwap: number | null
  trade_count: number | null
  is_intraday: boolean
}

export interface CryptoSnapshot {
  symbol: string
  provider: string
  timestamp_ns: number | null
  quote: CryptoQuote | null
  latest_trade: CryptoTick | null
  daily_bar: CryptoBar | null
  prev_daily_bar: CryptoBar | null
  minute_bar: CryptoBar | null
}
