import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { CatalystEvent } from '@/types/biotech'

const typeColors: Record<string, string> = {
  pdufa: 'bg-red-500/15 text-red-700 dark:text-red-400',
  adcom: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  phase_3: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  phase_2: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  phase_1: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  nda_filing: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  bla_filing: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  conference: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
  earnings: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  data_readout: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
}

interface CatalystCardProps {
  event: CatalystEvent
  onClick?: () => void
}

export function CatalystCard({ event, onClick }: CatalystCardProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{event.symbol}</span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', typeColors[event.catalyst_type] ?? '')}>
            {event.catalyst_type.replace('_', ' ').toUpperCase()}
          </Badge>
          {event.date_is_estimated && (
            <span className="text-[10px] text-muted-foreground italic">est.</span>
          )}
        </div>
        <div className="text-sm font-medium truncate">{event.drug_name}</div>
        <div className="text-xs text-muted-foreground truncate">{event.indication}</div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>{formatDate(event.event_date)}</span>
          {event.expected_move_pct != null && (
            <span>±{event.expected_move_pct}% expected</span>
          )}
        </div>
      </div>

      {event.approval_probability != null && (
        <div className="flex flex-col items-center gap-1 min-w-[50px]">
          <div className="text-xs text-muted-foreground">Prob</div>
          <div className="w-10 h-10 rounded-full border-2 border-primary flex items-center justify-center">
            <span className="text-xs font-semibold">{Math.round(event.approval_probability * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
