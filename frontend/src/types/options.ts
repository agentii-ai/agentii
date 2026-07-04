import type { BarTimeframe, OptionType } from './enums'

export interface Greeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  implied_volatility: number
  is_complete: boolean
}

export interface OptionQuote {
  symbol: string
  provider: string
  timestamp_ns: number | null
  underlying_symbol: string
  contract_symbol: string
  expiration: string
  dte: number | null
  strike: number
  option_type: OptionType
  contract_size: number
  bid: number | null
  bid_size: number | null
  bid_exchange: string | null
  bid_time: string | null
  ask: number | null
  ask_size: number | null
  ask_exchange: string | null
  ask_time: string | null
  mark: number | null
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  open_bid: number | null
  open_ask: number | null
  bid_high: number | null
  ask_high: number | null
  bid_low: number | null
  ask_low: number | null
  close_size: number | null
  close_time: string | null
  close_bid: number | null
  close_bid_size: number | null
  close_bid_time: string | null
  close_ask: number | null
  close_ask_size: number | null
  close_ask_time: string | null
  last_trade_price: number | null
  last_trade_size: number | null
  last_trade_time: string | null
  tick: string | null
  prev_close: number | null
  change: number | null
  change_percent: number | null
  volume: number | null
  open_interest: number | null
  implied_volatility: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  rho: number | null
  theoretical_price: number | null
  mid_price: number | null
  spread: number | null
  has_greeks: boolean
}

export interface OptionBar {
  symbol: string
  provider: string
  timestamp_ns: number | null
  contract_symbol: string
  underlying_symbol: string
  date: string
  timeframe: BarTimeframe
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  open_interest: number | null
  vwap: number | null
  trade_count: number | null
  is_intraday: boolean
}

export interface OptionsChain {
  underlying_symbol: string
  snapshot_time: string
  provider: string
  contracts: OptionQuote[]
  call_count: number
  put_count: number
  total_contracts: number
}
