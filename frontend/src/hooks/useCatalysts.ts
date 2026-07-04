import { useMemo } from 'react'
import { useCatalysts } from '@/api/catalysts'
import type { CatalystEvent, CatalystType } from '@/types'

interface UseCatalystsReturn {
  events: CatalystEvent[]
  grouped: Map<string, CatalystEvent[]>
  isLoading: boolean
  isError: boolean
}

export function useCatalystsFiltered(params?: {
  catalyst_type?: CatalystType
  therapeutic_area?: string
  start_date?: string
  end_date?: string
}): UseCatalystsReturn {
  const { data: events, isLoading, isError } = useCatalysts(params)

  const grouped = useMemo(() => {
    if (!events || events.length === 0) return new Map<string, CatalystEvent[]>()

    const sorted = [...events].sort((a, b) => {
      if (!a.event_date) return 1
      if (!b.event_date) return -1
      return a.event_date.localeCompare(b.event_date)
    })

    const map = new Map<string, CatalystEvent[]>()
    for (const event of sorted) {
      const weekKey = getWeekKey(event.event_date)
      const existing = map.get(weekKey) ?? []
      existing.push(event)
      map.set(weekKey, existing)
    }
    return map
  }, [events])

  return { events: events ?? [], grouped, isLoading, isError }
}

function getWeekKey(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toISOString().split('T')[0]
}
