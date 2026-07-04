import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import type { CatalystEvent } from '@/types/biotech'

interface CatalystTimelineProps {
  events: CatalystEvent[]
}

const typeColors: Record<string, string> = {
  pdufa: 'bg-red-500',
  adcom: 'bg-orange-500',
  phase_3: 'bg-blue-500',
  phase_2: 'bg-cyan-500',
  phase_1: 'bg-teal-500',
  nda_filing: 'bg-purple-500',
  bla_filing: 'bg-purple-500',
  data_readout: 'bg-indigo-500',
}

export function CatalystTimeline({ events }: CatalystTimelineProps) {
  const navigate = useNavigate()

  if (!events || events.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming catalyst events found.</p>
  }

  return (
    <div className="space-y-0 my-2">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-3">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${typeColors[event.catalyst_type] ?? 'bg-gray-500'}`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>

          {/* Content */}
          <div
            className="pb-4 cursor-pointer hover:opacity-80"
            onClick={() => navigate(`/options/${event.symbol}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/options/${event.symbol}`) }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold">{event.symbol}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {event.catalyst_type.replace('_', ' ').toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(event.event_date)}</span>
            </div>
            <div className="text-sm">{event.drug_name} — {event.indication}</div>
            {event.approval_probability != null && (
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${event.approval_probability * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{Math.round(event.approval_probability * 100)}%</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
