import type { OptionType } from '@/types/enums'

interface ParsedOCC {
  underlying: string
  expiry: Date
  type: OptionType
  strike: number
}

/**
 * Parse an OCC option symbol (21 chars) into its components.
 * Format: SYMBOL(6) DATE(6:YYMMDD) TYPE(1:C/P) STRIKE(8:price×1000)
 * Example: "MRNA  260321C00150000" → { underlying: "MRNA", expiry: 2026-03-21, type: "call", strike: 150 }
 */
export function parseOCC(symbol: string): ParsedOCC | null {
  // OCC symbols are ALWAYS exactly 21 characters
  if (!symbol || symbol.length !== 21) return null

  const underlying = symbol.slice(0, 6).trim()
  const dateStr = symbol.slice(6, 12)
  const typeChar = symbol.slice(12, 13)
  const strikeStr = symbol.slice(13, 21)

  if (!underlying || !/^\d{6}$/.test(dateStr)) return null
  if (typeChar !== 'C' && typeChar !== 'P') return null

  const year = 2000 + Number.parseInt(dateStr.slice(0, 2), 10)
  const month = Number.parseInt(dateStr.slice(2, 4), 10) - 1
  const day = Number.parseInt(dateStr.slice(4, 6), 10)
  const expiry = new Date(year, month, day)

  const strike = Number.parseInt(strikeStr, 10) / 1000

  return {
    underlying,
    expiry,
    type: typeChar === 'C' ? 'call' : 'put',
    strike,
  }
}

/**
 * Format an OCC symbol to human-readable form.
 * "MRNA  260321C00150000" → "MRNA Mar 21 '26 $150 Call"
 */
export function formatOCCHuman(symbol: string): string {
  const parsed = parseOCC(symbol)
  if (!parsed) return symbol.trim()

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[parsed.expiry.getMonth()]
  const day = parsed.expiry.getDate()
  const year = String(parsed.expiry.getFullYear()).slice(2)
  const strike = parsed.strike % 1 === 0 ? `$${parsed.strike}` : `$${parsed.strike.toFixed(2)}`
  const type = parsed.type === 'call' ? 'Call' : 'Put'

  return `${parsed.underlying} ${month} ${day} '${year} ${strike} ${type}`
}

/**
 * Validate whether a string is a valid OCC option symbol.
 */
export function isValidOCC(symbol: string): boolean {
  return parseOCC(symbol) !== null
}
