import { cn } from '@/lib/utils'
import type { CliReadinessState } from '@/types/cli-readiness'

interface CliStatusIndicatorProps {
  readiness: CliReadinessState
  errorMessage?: string
  className?: string
}

/** T053: Small colored dot indicating CLI readiness state per tab. */
export function CliStatusIndicator({ readiness, errorMessage, className }: CliStatusIndicatorProps) {
  const title = {
    connecting: 'Connecting...',
    ready: 'Ready',
    'no-keys': 'No API key — configure in Settings',
    error: errorMessage ?? 'Error',
  }[readiness]

  return (
    <span
      title={title}
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        readiness === 'connecting' && 'animate-pulse bg-yellow-500',
        readiness === 'ready' && 'bg-green-500',
        readiness === 'no-keys' && 'bg-amber-500',
        readiness === 'error' && 'bg-red-500',
        className,
      )}
    />
  )
}
