import type { Exchange, OptionType } from './enums'
import type { Greeks } from './options'

export interface StockPosition {
  symbol: string
  exchange: Exchange
  quantity: number
  avg_entry_price: number
  current_price: number
  market_value: number
  cost_basis: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  provider: string
}

export interface OptionPosition {
  contract_symbol: string
  underlying_symbol: string
  strike: number
  expiration: string
  option_type: OptionType
  quantity: number
  avg_entry_price: number
  current_price: number
  market_value: number
  cost_basis: number
  position_greeks: Greeks
  days_to_expiry: number
  is_expired: boolean
  unrealized_pnl: number
  unrealized_pnl_pct: number
  provider: string
}

export interface Portfolio {
  account_id: string
  stock_positions: StockPosition[]
  option_positions: OptionPosition[]
  net_greeks: Greeks
  total_market_value: number
  total_cost_basis: number
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  cash_balance: number
  buying_power: number
  updated_at: string
}
