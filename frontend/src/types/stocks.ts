import type { BarTimeframe, Exchange, MarketSession } from './enums'

export interface StockTick {
  symbol: string
  provider: string
  timestamp_ns: number | null
  price: number
  size: number
  exchange: Exchange | null
  conditions: string[] | null
}

export interface StockQuote {
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

export interface StockBar {
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
  session: MarketSession | null
  is_intraday: boolean
}

export interface StockSnapshot {
  symbol: string
  provider: string
  timestamp_ns: number | null
  quote: StockQuote | null
  latest_trade: StockTick | null
  daily_bar: StockBar | null
  prev_daily_bar: StockBar | null
  minute_bar: StockBar | null
}
