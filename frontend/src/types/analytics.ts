import type { OptionType, OrderSide, PricingModel } from './enums'

export interface IVPoint {
  strike: number
  expiration: string
  implied_volatility: number
  option_type: OptionType
  underlying_price: number
  timestamp: string
}

export interface VolatilitySurface {
  underlying_symbol: string
  points: IVPoint[]
  snapshot_time: string
  provider: string
}

export interface OptionPricingResult {
  price: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  implied_volatility: number
  pricing_model: PricingModel
  underlying_price: number
  strike: number
  risk_free_rate: number
  time_to_expiry: number
  option_type: OptionType
}

export interface PayoffPoint {
  underlying_price: number
  profit_loss: number
}

export interface PayoffLeg {
  contract_symbol: string
  option_type: OptionType
  strike: number
  expiration: string
  quantity: number
  premium: number
  side: OrderSide
}

export interface PayoffDiagram {
  strategy_name: string
  legs: PayoffLeg[]
  points: PayoffPoint[]
  breakeven_points: number[]
  max_profit: number | null
  max_loss: number | null
  net_debit_credit: number
}
