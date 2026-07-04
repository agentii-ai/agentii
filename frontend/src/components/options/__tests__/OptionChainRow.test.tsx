import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionChainRow } from '../OptionChainRow'
import type { OptionQuote } from '@/types/options'

function makeQuote(overrides: Partial<OptionQuote> = {}): OptionQuote {
  return {
    symbol: 'MRNA', provider: 'mock', timestamp_ns: null,
    underlying_symbol: 'MRNA', contract_symbol: 'MRNA  260321C00045000',
    expiration: '2026-03-21', dte: 19, strike: 45, option_type: 'call', contract_size: 100,
    bid: 2.10, bid_size: 20, bid_exchange: null, bid_time: null,
    ask: 2.30, ask_size: 15, ask_exchange: null, ask_time: null, mark: 2.20,
    open: null, high: null, low: null, close: null,
    open_bid: null, open_ask: null, bid_high: null, ask_high: null,
    bid_low: null, ask_low: null, close_size: null, close_time: null,
    close_bid: null, close_bid_size: null, close_bid_time: null,
    close_ask: null, close_ask_size: null, close_ask_time: null,
    last_trade_price: 2.15, last_trade_size: 10, last_trade_time: null, tick: null,
    prev_close: 2.00, change: 0.15, change_percent: 7.5,
    volume: 1500, open_interest: 8000,
    implied_volatility: 0.42, delta: 0.55, gamma: 0.03, theta: -0.02, vega: 0.08, rho: 0.01,
    theoretical_price: 2.18, mid_price: 2.20, spread: 0.20, has_greeks: true,
    ...overrides,
  }
}

describe('OptionChainRow', () => {
  it('renders strike price', () => {
    render(
      <OptionChainRow
        strike={45}
        call={makeQuote()}
        put={makeQuote({ option_type: 'put', delta: -0.45 })}
        isATM={false}
        visibleColumns={['bid', 'ltp', 'ask', 'iv', 'delta']}
      />,
    )
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('highlights ATM row', () => {
    const { container } = render(
      <OptionChainRow
        strike={45}
        call={makeQuote()}
        put={makeQuote({ option_type: 'put' })}
        isATM={true}
        visibleColumns={['bid', 'ltp', 'ask']}
      />,
    )
    const row = container.firstElementChild
    expect(row?.className).toContain('bg-accent')
  })

  it('formats bid/ask values correctly', () => {
    render(
      <OptionChainRow
        strike={45}
        call={makeQuote({ bid: 2.10, ask: 2.30 })}
        put={undefined}
        isATM={false}
        visibleColumns={['bid', 'ask']}
      />,
    )
    expect(screen.getByText('2.10')).toBeInTheDocument()
    expect(screen.getByText('2.30')).toBeInTheDocument()
  })

  it('calls onSelect when clicking call side', () => {
    const onSelect = vi.fn()
    const call = makeQuote()
    render(
      <OptionChainRow
        strike={45}
        call={call}
        put={undefined}
        isATM={false}
        visibleColumns={['bid', 'ltp', 'ask']}
        onSelect={onSelect}
      />,
    )
    // Click the call side
    const callSide = screen.getAllByRole('button')[0]
    callSide.click()
    expect(onSelect).toHaveBeenCalledWith(call)
  })
})
