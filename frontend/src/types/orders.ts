import type { AssetClass, Exchange, OrderSide, OrderStatus, OrderType, TimeInForce } from './enums'

export interface Order {
  order_id: string
  symbol: string
  asset_class: AssetClass
  exchange: Exchange
  side: OrderSide
  order_type: OrderType
  time_in_force: TimeInForce
  quantity: number
  filled_quantity: number
  price: number | null
  stop_price: number | null
  avg_fill_price: number | null
  status: OrderStatus
  provider: string
  agent_id: string | null
  strategy_id: string | null
  created_at: string
  submitted_at: string | null
  filled_at: string | null
  cancelled_at: string | null
  expired_at: string | null
}

export interface Trade {
  trade_id: string
  order_id: string
  symbol: string
  asset_class: AssetClass
  exchange: Exchange
  side: OrderSide
  quantity: number
  price: number
  commission: number
  provider: string
  executed_at: string
  agent_id: string | null
  strategy_id: string | null
}
