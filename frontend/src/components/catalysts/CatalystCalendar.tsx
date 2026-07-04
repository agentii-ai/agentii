import { CatalystCard } from './CatalystCard'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { CatalystEvent } from '@/types/biotech'

interface CatalystCalendarProps {
  grouped: Map<string, CatalystEvent[]>
  onEventClick: (event: CatalystEvent) => void
}

export function CatalystCalendar({ grouped, onEventClick }: CatalystCalendarProps) {
  if (grouped.size === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        No catalyst events found for the selected filters.
      </div>
    )
  }

  const weeks = [...grouped.entries()]

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-6 p-4">
        {weeks.map(([weekKey, events]) => (
          <div key={weekKey}>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-1 mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {formatWeekHeader(weekKey)}
              </h3>
            </div>
            <div className="space-y-2">
              {events.map((event) => (
                <CatalystCard
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function formatWeekHeader(weekKey: string): string {
  if (weekKey === 'TBD') return 'Date TBD'
  const d = new Date(weekKey + 'T12:00:00')
  const end = new Date(d)
  end.setDate(d.getDate() + 6)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `Week of ${months[d.getMonth()]} ${d.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${d.getFullYear()}`
}
