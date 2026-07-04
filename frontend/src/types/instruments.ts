import type { AssetClass, Exchange, OptionStyle, OptionType } from './enums'

export interface Instrument {
  symbol: string
  asset_class: AssetClass
  exchange: Exchange
  name: string
  currency: string
}

export interface EquityInstrument extends Instrument {
  asset_class: 'equity'
  sector: string | null
  industry: string | null
  market_cap: number | null
  has_fda_pipeline: boolean
  clinical_stage: string | null
  is_biotech: boolean
}

export interface OptionInstrument extends Instrument {
  asset_class: 'option'
  underlying_symbol: string
  strike_price: number
  expiration_date: string
  option_type: OptionType
  option_style: OptionStyle
  contract_size: number
  days_to_expiry: number
  is_expired: boolean
}
