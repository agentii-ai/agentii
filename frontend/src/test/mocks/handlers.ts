import { http, HttpResponse } from 'msw'
import { getBarsForSymbol, getSnapshotForSymbol } from '../fixtures/stocks'
import { mrnaOptionsChain, generateOptionsChain } from '../fixtures/options'
import { catalystEvents, fdaDecisions } from '../fixtures/catalysts'
import { portfolio } from '../fixtures/portfolio'
import { orders, trades } from '../fixtures/orders'
import { searchInstruments, equityInstruments } from '../fixtures/instruments'

const API = '*/api/v1'

export const handlers = [
  // Market Data
  http.get(`${API}/bars/:symbol`, ({ params, request }) => {
    const symbol = params.symbol as string
    const url = new URL(request.url)
    const bars = getBarsForSymbol(symbol)
    const timeframe = url.searchParams.get('timeframe') || '1d'
    return HttpResponse.json({ bars: bars.filter((b) => b.timeframe === timeframe || timeframe === '1d') })
  }),

  http.get(`${API}/quotes/:symbol`, ({ params }) => {
    const symbol = params.symbol as string
    return HttpResponse.json(getSnapshotForSymbol(symbol))
  }),

  http.post(`${API}/quotes/multi`, async ({ request }) => {
    const body = (await request.json()) as { symbols: { symbol: string; exchange: string }[] }
    const results = body.symbols.map((s) => {
      const snapshot = getSnapshotForSymbol(s.symbol)
      return { symbol: s.symbol, exchange: s.exchange, data: snapshot.quote }
    })
    return HttpResponse.json({ results })
  }),

  // Options
  http.get(`${API}/options/:symbol`, ({ params }) => {
    const symbol = params.symbol as string
    if (symbol === 'MRNA') return HttpResponse.json(mrnaOptionsChain)
    return HttpResponse.json(generateOptionsChain(symbol, 100))
  }),

  http.get(`${API}/options/:symbol/surface`, ({ params }) => {
    const symbol = params.symbol as string
    const chain = symbol === 'MRNA' ? mrnaOptionsChain : generateOptionsChain(symbol, 100)
    const points = chain.contracts
      .filter((c) => c.implied_volatility != null)
      .map((c) => ({
        strike: c.strike,
        expiration: c.expiration,
        implied_volatility: c.implied_volatility!,
        option_type: c.option_type,
        underlying_price: 42,
        timestamp: new Date().toISOString(),
      }))
    return HttpResponse.json({ underlying_symbol: symbol, points, snapshot_time: new Date().toISOString(), provider: 'mock' })
  }),

  http.post(`${API}/options/pricing`, () => {
    return HttpResponse.json({ price: 3.25, delta: 0.55, gamma: 0.04, theta: -0.03, vega: 0.12, rho: 0.02, implied_volatility: 0.38, pricing_model: 'black_scholes', underlying_price: 42, strike: 45, risk_free_rate: 0.05, time_to_expiry: 0.05, option_type: 'call' })
  }),

  http.post(`${API}/options/payoff`, () => {
    const points = Array.from({ length: 100 }, (_, i) => {
      const price = 20 + i * 0.5
      return { underlying_price: price, profit_loss: price > 45 ? (price - 45) * 100 - 250 : -250 }
    })
    return HttpResponse.json({ strategy_name: 'Long Call', legs: [], points, breakeven_points: [47.5], max_profit: null, max_loss: -250, net_debit_credit: -250 })
  }),

  // Instruments
  http.get(`${API}/instruments/search`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q') || ''
    return HttpResponse.json({ results: searchInstruments(q).slice(0, 20) })
  }),

  http.get(`${API}/instruments/:symbol`, ({ params }) => {
    const symbol = params.symbol as string
    const found = equityInstruments.find((i) => i.symbol === symbol)
    if (found) return HttpResponse.json(found)
    return HttpResponse.json({ symbol, asset_class: 'equity', exchange: 'NASDAQ', name: symbol, currency: 'USD', sector: null, industry: null, market_cap: null, has_fda_pipeline: false, clinical_stage: null, is_biotech: false })
  }),

  // Catalysts
  http.get(`${API}/catalysts`, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('catalyst_type')
    let events = catalystEvents
    if (type) events = events.filter((e) => e.catalyst_type === type)
    return HttpResponse.json({ events })
  }),

  http.get(`${API}/catalysts/:id`, ({ params }) => {
    const id = params.id as string
    const event = catalystEvents.find((e) => e.id === id)
    if (!event) return new HttpResponse(null, { status: 404 })
    const instrument = equityInstruments.find((i) => i.symbol === event.symbol)
    return HttpResponse.json({ event, instrument: instrument ?? null, snapshot: getSnapshotForSymbol(event.symbol), chain_summary: { total_call_oi: 150000, total_put_oi: 120000, pcr: 0.8 } })
  }),

  http.get(`${API}/catalysts/:id/decision`, ({ params }) => {
    const id = params.id as string
    const decision = fdaDecisions.find((d) => d.catalyst_event_id === id)
    return HttpResponse.json(decision ?? null)
  }),

  // Portfolio
  http.get(`${API}/portfolio`, () => HttpResponse.json(portfolio)),

  http.get(`${API}/positions`, () => HttpResponse.json({ stock_positions: portfolio.stock_positions, option_positions: portfolio.option_positions })),

  // Orders
  http.get(`${API}/orders`, () => HttpResponse.json({ orders })),

  http.post(`${API}/orders`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const order = { order_id: `ord-${Date.now()}`, ...body, filled_quantity: 0, avg_fill_price: null, status: 'pending', provider: 'alpaca', created_at: new Date().toISOString(), submitted_at: new Date().toISOString(), filled_at: null, cancelled_at: null, expired_at: null }
    return HttpResponse.json({ order })
  }),

  http.delete(`${API}/orders/:orderId`, ({ params }) => {
    const found = orders.find((o) => o.order_id === params.orderId)
    if (!found) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ order: { ...found, status: 'cancelled', cancelled_at: new Date().toISOString() } })
  }),

  http.get(`${API}/trades`, () => HttpResponse.json({ trades })),

  // Auth
  http.post(`${API}/auth/login`, () => HttpResponse.json({ token: 'mock-jwt-token', user: { username: 'trader' } })),
  http.post(`${API}/auth/logout`, () => HttpResponse.json({ status: 'ok' })),
  http.get(`${API}/auth/session`, () => HttpResponse.json({ authenticated: true, user: { username: 'trader' } })),

  // Agent
  http.get(`${API}/agent/conversations/:id`, () => HttpResponse.json({ id: 'conv-1', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),

  // Flows
  http.get(`${API}/flows`, () => HttpResponse.json({ workflows: [] })),
  http.post(`${API}/flows`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ workflow: { id: `flow-${Date.now()}`, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
  }),
  http.put(`${API}/flows/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ workflow: { id: params.id, ...body, updatedAt: new Date().toISOString() } })
  }),
  http.delete(`${API}/flows/:id`, () => HttpResponse.json({ status: 'ok' })),
  http.post(`${API}/flows/:id/run`, () => HttpResponse.json({ run_id: `run-${Date.now()}`, status: 'started' })),
]
