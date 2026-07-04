import { useMemo } from 'react'
import { useCatalysts } from '@/api/catalysts'
import type { SeriesMarkerShape, Time } from 'lightweight-charts'
import type { CatalystEvent } from '@/types/biotech'

export interface CatalystMarker {
  time: Time
  position: 'aboveBar' | 'belowBar' | 'inBar'
  color: string
  shape: SeriesMarkerShape
  text: string
  id: string
  catalyst: CatalystEvent
}

const markerConfig: Record<string, { color: string; shape: 'arrowDown' | 'circle' | 'square' }> = {
  pdufa: { color: '#ef4444', shape: 'arrowDown' },
  adcom: { color: '#f97316', shape: 'square' },
  phase_3: { color: '#3b82f6', shape: 'circle' },
  phase_2: { color: '#06b6d4', shape: 'circle' },
  phase_1: { color: '#14b8a6', shape: 'circle' },
  nda_filing: { color: '#a855f7', shape: 'square' },
  bla_filing: { color: '#a855f7', shape: 'square' },
  data_readout: { color: '#6366f1', shape: 'circle' },
  conference: { color: '#64748b', shape: 'circle' },
  earnings: { color: '#eab308', shape: 'square' },
  priority_review: { color: '#ec4899', shape: 'arrowDown' },
  breakthrough: { color: '#10b981', shape: 'arrowDown' },
}

export function useCatalystMarkers(symbol: string | null): CatalystMarker[] {
  const { data: events = [] } = useCatalysts({ limit: 100 })

  return useMemo(() => {
    if (!symbol || events.length === 0) return []

    const symbolEvents = events.filter((e) => e.symbol === symbol && e.event_date)

    return symbolEvents.map((event) => {
      const config = markerConfig[event.catalyst_type] ?? { color: '#64748b', shape: 'circle' as const }

      return {
        time: event.event_date as Time,
        position: 'aboveBar' as const,
        color: config.color,
        shape: config.shape,
        text: event.catalyst_type.toUpperCase().slice(0, 1),
        id: event.id,
        catalyst: event,
      }
    })
  }, [symbol, events])
}
