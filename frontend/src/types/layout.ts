import type { BarTimeframe } from './enums'

export interface LayoutConfig {
  sidebarWidth: number
  terminalPanelWidth: number
  terminalPanelVisible: boolean
  activePage: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  defaultTimeframe: BarTimeframe
  optionChainColumns: OptionChainColumnKey[]
  optionChainStrikeCount: number
  notificationsEnabled: boolean
  soundEnabled: boolean
}

export type OptionChainColumnKey =
  | 'oi' | 'volume' | 'bid_qty' | 'bid' | 'ltp' | 'ask' | 'ask_qty'
  | 'spread' | 'strike' | 'iv' | 'delta' | 'gamma' | 'theta' | 'vega'
