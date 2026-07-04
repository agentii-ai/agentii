import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getMarketSession, isMarketOpen, formatMarketStatus } from '@/lib/market-hours'

describe('market-hours', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "regular" during market hours on a weekday', () => {
    // Wednesday March 4, 2026 at 10:30 AM ET
    vi.setSystemTime(new Date('2026-03-04T15:30:00Z')) // 10:30 AM ET
    expect(getMarketSession()).toBe('regular')
    expect(isMarketOpen()).toBe(true)
  })

  it('returns "pre" during pre-market hours', () => {
    // Wednesday March 4, 2026 at 7:00 AM ET
    vi.setSystemTime(new Date('2026-03-04T12:00:00Z')) // 7:00 AM ET
    expect(getMarketSession()).toBe('pre')
    expect(isMarketOpen()).toBe(false)
  })

  it('returns "post" during post-market hours', () => {
    // Wednesday March 4, 2026 at 5:00 PM ET
    vi.setSystemTime(new Date('2026-03-04T22:00:00Z')) // 5:00 PM ET
    expect(getMarketSession()).toBe('post')
    expect(isMarketOpen()).toBe(false)
  })

  it('returns "closed" on weekends', () => {
    // Saturday March 7, 2026
    vi.setSystemTime(new Date('2026-03-07T15:30:00Z'))
    expect(getMarketSession()).toBe('closed')
  })

  it('returns "closed" late at night', () => {
    // Wednesday March 4, 2026 at 2:00 AM ET
    vi.setSystemTime(new Date('2026-03-04T07:00:00Z')) // 2:00 AM ET
    expect(getMarketSession()).toBe('closed')
  })

  it('formatMarketStatus returns correct labels', () => {
    vi.setSystemTime(new Date('2026-03-04T15:30:00Z'))
    expect(formatMarketStatus()).toBe('Market Open')

    vi.setSystemTime(new Date('2026-03-07T15:30:00Z'))
    expect(formatMarketStatus()).toBe('Market Closed')
  })
})
