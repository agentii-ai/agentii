import { describe, it, expect } from 'vitest'
import { parseOCC, formatOCCHuman, isValidOCC } from '@/lib/occ'

describe('parseOCC', () => {
  it('parses a valid call OCC symbol', () => {
    const result = parseOCC('MRNA  260321C00150000')
    expect(result).not.toBeNull()
    expect(result!.underlying).toBe('MRNA')
    expect(result!.type).toBe('call')
    expect(result!.strike).toBe(150)
    expect(result!.expiry.getFullYear()).toBe(2026)
    expect(result!.expiry.getMonth()).toBe(2) // March = 2
    expect(result!.expiry.getDate()).toBe(21)
  })

  it('parses a valid put OCC symbol', () => {
    const result = parseOCC('SPY   260321P00500000')
    expect(result).not.toBeNull()
    expect(result!.underlying).toBe('SPY')
    expect(result!.type).toBe('put')
    expect(result!.strike).toBe(500)
  })

  it('parses fractional strike prices', () => {
    const result = parseOCC('AAPL  260321C00195500')
    expect(result).not.toBeNull()
    expect(result!.strike).toBe(195.5)
  })

  it('returns null for empty string', () => {
    expect(parseOCC('')).toBeNull()
  })

  it('returns null for too-short string', () => {
    expect(parseOCC('MRNA')).toBeNull()
  })

  it('returns null for invalid type character', () => {
    expect(parseOCC('MRNA  260321X00150000')).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(parseOCC('MRNA  ABCDEFC00150000')).toBeNull()
  })
})

describe('formatOCCHuman', () => {
  it('formats a call symbol to human-readable', () => {
    expect(formatOCCHuman('MRNA  260321C00150000')).toBe("MRNA Mar 21 '26 $150 Call")
  })

  it('formats a put symbol to human-readable', () => {
    expect(formatOCCHuman('SPY   260321P00500000')).toBe("SPY Mar 21 '26 $500 Put")
  })

  it('formats fractional strikes', () => {
    expect(formatOCCHuman('AAPL  260321C00195500')).toBe("AAPL Mar 21 '26 $195.50 Call")
  })

  it('returns trimmed input for invalid symbols', () => {
    expect(formatOCCHuman('INVALID')).toBe('INVALID')
  })
})

describe('isValidOCC', () => {
  it('returns true for valid OCC symbols', () => {
    expect(isValidOCC('MRNA  260321C00150000')).toBe(true)
    expect(isValidOCC('SPY   260321P00500000')).toBe(true)
  })

  it('returns false for invalid symbols', () => {
    expect(isValidOCC('')).toBe(false)
    expect(isValidOCC('MRNA')).toBe(false)
    expect(isValidOCC('not-an-occ-symbol')).toBe(false)
  })
})
