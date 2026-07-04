import type { Portfolio, StockPosition, OptionPosition } from '@/types/portfolio'
import type { Greeks } from '@/types/options'

const netGreeks: Greeks = {
  delta: 125.4,
  gamma: 8.2,
  theta: -45.3,
  vega: 62.1,
  rho: 3.5,
  implied_volatility: 0.38,
  is_complete: true,
}

export const stockPositions: StockPosition[] = [
  { symbol: 'MRNA', exchange: 'NASDAQ', quantity: 500, avg_entry_price: 38.5, current_price: 42.1, market_value: 21050, cost_basis: 19250, unrealized_pnl: 1800, unrealized_pnl_pct: 9.35, provider: 'alpaca' },
  { symbol: 'NVDA', exchange: 'NASDAQ', quantity: 50, avg_entry_price: 850, current_price: 880, market_value: 44000, cost_basis: 42500, unrealized_pnl: 1500, unrealized_pnl_pct: 3.53, provider: 'alpaca' },
  { symbol: 'BNTX', exchange: 'NASDAQ', quantity: 200, avg_entry_price: 105, current_price: 112, market_value: 22400, cost_basis: 21000, unrealized_pnl: 1400, unrealized_pnl_pct: 6.67, provider: 'alpaca' },
]

export const optionPositions: OptionPosition[] = [
  { contract_symbol: 'MRNA  260321C00045000', underlying_symbol: 'MRNA', strike: 45, expiration: '2026-03-21', option_type: 'call', quantity: 10, avg_entry_price: 2.5, current_price: 3.2, market_value: 3200, cost_basis: 2500, position_greeks: { delta: 55.2, gamma: 4.1, theta: -18.5, vega: 28.3, rho: 1.2, implied_volatility: 0.42, is_complete: true }, days_to_expiry: 19, is_expired: false, unrealized_pnl: 700, unrealized_pnl_pct: 28, provider: 'alpaca' },
  { contract_symbol: 'MRNA  260417P00035000', underlying_symbol: 'MRNA', strike: 35, expiration: '2026-04-17', option_type: 'put', quantity: -5, avg_entry_price: 1.8, current_price: 1.2, market_value: -600, cost_basis: -900, position_greeks: { delta: -15.3, gamma: 1.8, theta: -8.2, vega: 12.5, rho: -0.5, implied_volatility: 0.48, is_complete: true }, days_to_expiry: 46, is_expired: false, unrealized_pnl: 300, unrealized_pnl_pct: 33.3, provider: 'alpaca' },
  { contract_symbol: 'BNTX  260515C00120000', underlying_symbol: 'BNTX', strike: 120, expiration: '2026-05-15', option_type: 'call', quantity: 5, avg_entry_price: 4.0, current_price: 5.5, market_value: 2750, cost_basis: 2000, position_greeks: { delta: 32.5, gamma: 2.3, theta: -12.6, vega: 21.3, rho: 0.8, implied_volatility: 0.39, is_complete: true }, days_to_expiry: 74, is_expired: false, unrealized_pnl: 750, unrealized_pnl_pct: 37.5, provider: 'alpaca' },
  { contract_symbol: 'NVDA  260619C00900000', underlying_symbol: 'NVDA', strike: 900, expiration: '2026-06-19', option_type: 'call', quantity: 2, avg_entry_price: 45, current_price: 52, market_value: 10400, cost_basis: 9000, position_greeks: { delta: 48.0, gamma: 0.8, theta: -5.0, vega: 15.0, rho: 1.5, implied_volatility: 0.32, is_complete: true }, days_to_expiry: 109, is_expired: false, unrealized_pnl: 1400, unrealized_pnl_pct: 15.6, provider: 'alpaca' },
  { contract_symbol: 'SPY   260321P00500000', underlying_symbol: 'SPY', strike: 500, expiration: '2026-03-21', option_type: 'put', quantity: 3, avg_entry_price: 2.0, current_price: 0.8, market_value: 240, cost_basis: 600, position_greeks: { delta: 5.0, gamma: -0.8, theta: -1.0, vega: -15.0, rho: 0.5, implied_volatility: 0.22, is_complete: true }, days_to_expiry: 19, is_expired: false, unrealized_pnl: -360, unrealized_pnl_pct: -60, provider: 'alpaca' },
]

export const portfolio: Portfolio = {
  account_id: 'paper-001',
  stock_positions: stockPositions,
  option_positions: optionPositions,
  net_greeks: netGreeks,
  total_market_value: 103440,
  total_cost_basis: 95950,
  total_unrealized_pnl: 7490,
  total_unrealized_pnl_pct: 7.81,
  cash_balance: 46560,
  buying_power: 150000,
  updated_at: new Date().toISOString(),
}
