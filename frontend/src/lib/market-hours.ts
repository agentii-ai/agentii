import type { MarketSession } from '@/types/enums'

/**
 * Get the current US Eastern time as a Date object.
 */
function getEasternNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
}

/**
 * Check if a given date is a US market holiday (simplified — major holidays only).
 */
function isMarketHoliday(date: Date): boolean {
  const month = date.getMonth()
  const day = date.getDate()
  const dayOfWeek = date.getDay()

  // New Year's Day
  if (month === 0 && day === 1) return true
  // MLK Day (3rd Monday of January)
  if (month === 0 && dayOfWeek === 1 && day >= 15 && day <= 21) return true
  // Presidents' Day (3rd Monday of February)
  if (month === 1 && dayOfWeek === 1 && day >= 15 && day <= 21) return true
  // Good Friday — approximation, skip for simplicity
  // Memorial Day (last Monday of May)
  if (month === 4 && dayOfWeek === 1 && day >= 25) return true
  // Juneteenth
  if (month === 5 && day === 19) return true
  // Independence Day
  if (month === 6 && day === 4) return true
  // Labor Day (1st Monday of September)
  if (month === 8 && dayOfWeek === 1 && day <= 7) return true
  // Thanksgiving (4th Thursday of November)
  if (month === 10 && dayOfWeek === 4 && day >= 22 && day <= 28) return true
  // Christmas
  if (month === 11 && day === 25) return true

  return false
}

/**
 * Get the current market session based on US Eastern time.
 * Pre-market: 4:00 AM – 9:30 AM ET
 * Regular: 9:30 AM – 4:00 PM ET
 * Post-market: 4:00 PM – 8:00 PM ET
 */
export function getMarketSession(): MarketSession | 'closed' {
  const now = getEasternNow()
  const dayOfWeek = now.getDay()

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'closed'

  // Holiday
  if (isMarketHoliday(now)) return 'closed'

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  const preMarketOpen = 4 * 60       // 4:00 AM
  const regularOpen = 9 * 60 + 30    // 9:30 AM
  const regularClose = 16 * 60       // 4:00 PM
  const postMarketClose = 20 * 60    // 8:00 PM

  if (timeInMinutes >= preMarketOpen && timeInMinutes < regularOpen) return 'pre'
  if (timeInMinutes >= regularOpen && timeInMinutes < regularClose) return 'regular'
  if (timeInMinutes >= regularClose && timeInMinutes < postMarketClose) return 'post'

  return 'closed'
}

export function isMarketOpen(): boolean {
  return getMarketSession() === 'regular'
}

export function getNextMarketOpen(): Date {
  const now = getEasternNow()
  const next = new Date(now)

  // Move to next weekday at 9:30 AM ET
  do {
    next.setDate(next.getDate() + 1)
  } while (next.getDay() === 0 || next.getDay() === 6 || isMarketHoliday(next))

  next.setHours(9, 30, 0, 0)
  return next
}

export function formatMarketStatus(): string {
  const session = getMarketSession()
  switch (session) {
    case 'pre': return 'Pre-Market'
    case 'regular': return 'Market Open'
    case 'post': return 'Post-Market'
    case 'closed': return 'Market Closed'
  }
}
