import type { OptionQuote, OptionsChain } from '@/types/options'

function generateOptionQuote(
  underlying: string,
  strike: number,
  expiration: string,
  type: 'call' | 'put',
  underlyingPrice: number,
): OptionQuote {
  const itm = type === 'call' ? underlyingPrice > strike : underlyingPrice < strike
  const moneyness = Math.abs(underlyingPrice - strike) / underlyingPrice
  const baseIV = 0.35 + moneyness * 0.5 + Math.random() * 0.05
  const dte = Math.max(1, Math.floor((new Date(expiration).getTime() - Date.now()) / 86400000))
  const timeValue = Math.sqrt(dte / 365) * underlyingPrice * baseIV * 0.4
  const intrinsic = itm ? Math.abs(underlyingPrice - strike) : 0
  const mid = intrinsic + timeValue
  const spread = Math.max(0.05, mid * 0.03)

  const delta = type === 'call'
    ? 0.5 + (underlyingPrice - strike) / (underlyingPrice * 0.3) * 0.3
    : -(0.5 - (underlyingPrice - strike) / (underlyingPrice * 0.3) * 0.3)

  const padSymbol = underlying.padEnd(6, ' ')
  const yr = expiration.slice(2, 4)
  const mo = expiration.slice(5, 7)
  const dy = expiration.slice(8, 10)
  const typeChar = type === 'call' ? 'C' : 'P'
  const strikeStr = String(Math.round(strike * 1000)).padStart(8, '0')
  const contractSymbol = `${padSymbol}${yr}${mo}${dy}${typeChar}${strikeStr}`

  return {
    symbol: underlying,
    provider: 'mock',
    timestamp_ns: null,
    underlying_symbol: underlying,
    contract_symbol: contractSymbol,
    expiration,
    dte,
    strike,
    option_type: type,
    contract_size: 100,
    bid: +Math.max(0.01, mid - spread / 2).toFixed(2),
    bid_size: Math.floor(Math.random() * 50) + 1,
    bid_exchange: null,
    bid_time: null,
    ask: +(mid + spread / 2).toFixed(2),
    ask_size: Math.floor(Math.random() * 50) + 1,
    ask_exchange: null,
    ask_time: null,
    mark: +mid.toFixed(2),
    open: null, high: null, low: null, close: null,
    open_bid: null, open_ask: null, bid_high: null, ask_high: null,
    bid_low: null, ask_low: null, close_size: null, close_time: null,
    close_bid: null, close_bid_size: null, close_bid_time: null,
    close_ask: null, close_ask_size: null, close_ask_time: null,
    last_trade_price: +mid.toFixed(2),
    last_trade_size: 10,
    last_trade_time: null,
    tick: null,
    prev_close: +(mid * 0.98).toFixed(2),
    change: +(mid * 0.02).toFixed(2),
    change_percent: 2.0,
    volume: Math.floor(Math.random() * 5000) + 100,
    open_interest: Math.floor(Math.random() * 20000) + 500,
    implied_volatility: +baseIV.toFixed(4),
    delta: +Math.max(-1, Math.min(1, delta)).toFixed(4),
    gamma: +(0.02 + Math.random() * 0.03).toFixed(4),
    theta: +(-0.01 - Math.random() * 0.05).toFixed(4),
    vega: +(0.05 + Math.random() * 0.1).toFixed(4),
    rho: +(0.01 + Math.random() * 0.02).toFixed(4),
    theoretical_price: +mid.toFixed(2),
    mid_price: +mid.toFixed(2),
    spread: +spread.toFixed(2),
    has_greeks: true,
  }
}

export function generateOptionsChain(symbol: string, underlyingPrice: number): OptionsChain {
  const expirations = ['2026-03-21', '2026-04-17', '2026-05-15', '2026-06-19', '2026-09-18']
  const contracts: OptionQuote[] = []

  for (const exp of expirations) {
    const atmStrike = Math.round(underlyingPrice / 5) * 5
    for (let offset = -10; offset <= 10; offset++) {
      const strike = atmStrike + offset * 5
      if (strike <= 0) continue
      contracts.push(generateOptionQuote(symbol, strike, exp, 'call', underlyingPrice))
      contracts.push(generateOptionQuote(symbol, strike, exp, 'put', underlyingPrice))
    }
  }

  return {
    underlying_symbol: symbol,
    snapshot_time: new Date().toISOString(),
    provider: 'mock',
    contracts,
    call_count: contracts.filter((c) => c.option_type === 'call').length,
    put_count: contracts.filter((c) => c.option_type === 'put').length,
    total_contracts: contracts.length,
  }
}

export const mrnaOptionsChain = generateOptionsChain('MRNA', 42)
