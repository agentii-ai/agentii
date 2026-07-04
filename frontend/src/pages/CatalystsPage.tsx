import { useState, useMemo } from 'react'
import { CatalystFilter } from '@/components/catalysts/CatalystFilter'
import { CatalystCalendar } from '@/components/catalysts/CatalystCalendar'
import { CatalystDetail } from '@/components/catalysts/CatalystDetail'
import { useCatalystsFiltered } from '@/hooks/useCatalysts'
import type { CatalystEvent, CatalystType } from '@/types'

export default function CatalystsPage() {
  const [selectedTypes, setSelectedTypes] = useState<CatalystType[]>([])
  const [horizon, setHorizon] = useState('3m')
  const [therapeuticArea, setTherapeuticArea] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CatalystEvent | null>(null)

  const { start_date, end_date } = useMemo(() => {
    const now = new Date()
    const start = now.toISOString().split('T')[0]
    let end: string | undefined
    if (horizon === '1w') {
      const d = new Date(now)
      d.setDate(d.getDate() + 7)
      end = d.toISOString().split('T')[0]
    } else if (horizon === '1m') {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 1)
      end = d.toISOString().split('T')[0]
    } else if (horizon === '3m') {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 3)
      end = d.toISOString().split('T')[0]
    } else if (horizon === '6m') {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 6)
      end = d.toISOString().split('T')[0]
    }
    return { start_date: start, end_date: end }
  }, [horizon])

  const { grouped, isLoading } = useCatalystsFiltered({
    catalyst_type: selectedTypes.length > 0 ? selectedTypes[0] : undefined,
    therapeutic_area: therapeuticArea || undefined,
    start_date,
    end_date,
  })

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Biotech Catalysts</h1>
      </div>

      <CatalystFilter
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
        horizon={horizon}
        onHorizonChange={setHorizon}
        therapeuticArea={therapeuticArea}
        onTherapeuticAreaChange={setTherapeuticArea}
      />

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
          Loading catalysts...
        </div>
      ) : (
        <CatalystCalendar grouped={grouped} onEventClick={setSelectedEvent} />
      )}

      {selectedEvent && (
        <CatalystDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}
