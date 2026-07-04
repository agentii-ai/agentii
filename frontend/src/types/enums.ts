export type AssetClass = 'equity' | 'option' | 'etf' | 'crypto' | 'crypto_option'

export type Exchange = 'NYSE' | 'NASDAQ' | 'CBOE' | 'AMEX' | 'ARCA' | 'BATS' | 'IEX' | 'OTC' | 'OPRA'

export type OptionType = 'call' | 'put'

export type OptionStyle = 'american' | 'european'

export type BarTimeframe = 'tick' | '1s' | '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1d' | '1w' | '1mo'

export type MarketSession = 'pre' | 'regular' | 'post'

export type OrderSide = 'buy' | 'sell'

export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop'

export type OrderStatus = 'pending' | 'accepted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'expired'

export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls'

export type CatalystType =
  | 'pdufa' | 'adcom' | 'phase_1' | 'phase_2' | 'phase_3'
  | 'nda_filing' | 'bla_filing' | 'conference' | 'earnings'
  | 'data_readout' | 'priority_review' | 'breakthrough'

export type FDADecisionOutcome =
  | 'approved' | 'crl' | 'tentative_approval'
  | 'refused_to_file' | 'withdrawn' | 'pending'

export type PricingModel = 'black_scholes' | 'black_76' | 'binomial_tree'
