import type { CatalystType, Exchange, OrderSide, OrderStatus } from './enums'

export interface QuoteUpdateEvent {
  symbol: string
  exchange: Exchange
  ltp: number
  bid: number | null
  ask: number | null
  volume: number | null
  change: number | null
  change_percent: number | null
  timestamp: string
}

export interface OrderUpdateEvent {
  order_id: string
  symbol: string
  side: OrderSide
  status: OrderStatus
  filled_quantity: number
  avg_fill_price: number | null
  timestamp: string
}

export interface AgentStreamEvent {
  conversation_id: string
  message_id: string
  delta: string
  done: boolean
  generativeUI: {
    component: string
    props: Record<string, unknown>
  } | null
}

export interface CatalystAlertEvent {
  catalyst_event_id: string
  symbol: string
  drug_name: string
  catalyst_type: CatalystType
  event_date: string
  hours_until: number
}
