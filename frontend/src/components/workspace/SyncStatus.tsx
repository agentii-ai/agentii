import { Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type SyncState = 'synced' | 'syncing' | 'pending' | 'error' | 'offline'

interface SyncStatusProps {
  status: SyncState
  pendingFiles?: number
}

const icons: Record<SyncState, typeof Cloud> = {
  synced: Cloud,
  syncing: Loader2,
  pending: Cloud,
  error: AlertTriangle,
  offline: CloudOff,
}

const labels: Record<SyncState, string> = {
  synced: 'All changes synced',
  syncing: 'Syncing...',
  pending: 'Changes pending',
  error: 'Sync error — retrying',
  offline: 'Offline — changes saved locally',
}

export function SyncStatus({ status, pendingFiles }: SyncStatusProps) {
  const Icon = icons[status]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-label={labels[status]}>
          <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${status === 'syncing' ? 'animate-spin' : ''} ${status === 'error' ? 'text-amber-500' : ''}`} />
          {status === 'pending' && pendingFiles ? `${pendingFiles} pending` : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{labels[status]}</p>
      </TooltipContent>
    </Tooltip>
  )
}
