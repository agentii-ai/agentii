import type { AssetClass, Exchange } from './enums'

export interface WatchlistItem {
  symbol: string
  exchange: Exchange
  name: string
  asset_class: AssetClass
  addedAt: string
}

export interface Watchlist {
  id: string
  name: string
  items: WatchlistItem[]
  createdAt: string
  updatedAt: string
}
