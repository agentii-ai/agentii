import type { EquityInstrument, OptionInstrument } from '@/types/instruments'

export const equityInstruments: EquityInstrument[] = [
  { symbol: 'MRNA', asset_class: 'equity', exchange: 'NASDAQ', name: 'Moderna Inc', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 16_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 3', is_biotech: true },
  { symbol: 'AAPL', asset_class: 'equity', exchange: 'NASDAQ', name: 'Apple Inc', currency: 'USD', sector: 'Technology', industry: 'Consumer Electronics', market_cap: 3_000_000_000_000, has_fda_pipeline: false, clinical_stage: null, is_biotech: false },
  { symbol: 'SPY', asset_class: 'equity', exchange: 'ARCA', name: 'SPDR S&P 500 ETF Trust', currency: 'USD', sector: null, industry: null, market_cap: null, has_fda_pipeline: false, clinical_stage: null, is_biotech: false },
  { symbol: 'NVDA', asset_class: 'equity', exchange: 'NASDAQ', name: 'NVIDIA Corp', currency: 'USD', sector: 'Technology', industry: 'Semiconductors', market_cap: 2_200_000_000_000, has_fda_pipeline: false, clinical_stage: null, is_biotech: false },
  { symbol: 'BNTX', asset_class: 'equity', exchange: 'NASDAQ', name: 'BioNTech SE', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 25_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 2', is_biotech: true },
  { symbol: 'REGN', asset_class: 'equity', exchange: 'NASDAQ', name: 'Regeneron Pharmaceuticals', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 100_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 3', is_biotech: true },
  { symbol: 'VRTX', asset_class: 'equity', exchange: 'NASDAQ', name: 'Vertex Pharmaceuticals', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 110_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 3', is_biotech: true },
  { symbol: 'GILD', asset_class: 'equity', exchange: 'NASDAQ', name: 'Gilead Sciences', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 95_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 3', is_biotech: true },
  { symbol: 'AMGN', asset_class: 'equity', exchange: 'NASDAQ', name: 'Amgen Inc', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 150_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 3', is_biotech: true },
  { symbol: 'BIIB', asset_class: 'equity', exchange: 'NASDAQ', name: 'Biogen Inc', currency: 'USD', sector: 'Healthcare', industry: 'Biotechnology', market_cap: 30_000_000_000, has_fda_pipeline: true, clinical_stage: 'Phase 3', is_biotech: true },
]

export const optionInstruments: OptionInstrument[] = [
  { symbol: 'MRNA  260321C00150000', asset_class: 'option', exchange: 'OPRA', name: 'MRNA Mar 21 2026 150 Call', currency: 'USD', underlying_symbol: 'MRNA', strike_price: 150, expiration_date: '2026-03-21', option_type: 'call', option_style: 'american', contract_size: 100, days_to_expiry: 19, is_expired: false },
  { symbol: 'MRNA  260321P00030000', asset_class: 'option', exchange: 'OPRA', name: 'MRNA Mar 21 2026 30 Put', currency: 'USD', underlying_symbol: 'MRNA', strike_price: 30, expiration_date: '2026-03-21', option_type: 'put', option_style: 'american', contract_size: 100, days_to_expiry: 19, is_expired: false },
]

export function searchInstruments(query: string) {
  const q = query.toUpperCase()
  return [...equityInstruments, ...optionInstruments].filter(
    (i) => i.symbol.includes(q) || i.name.toUpperCase().includes(q),
  )
}
