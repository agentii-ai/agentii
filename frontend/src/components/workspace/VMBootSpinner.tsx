import { Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspaceStore } from '@/stores/workspaceStore'

export function VMBootSpinner({ onRetry }: { onRetry?: () => void }) {
  const vmStatus = useWorkspaceStore((s) => s.vmStatus)
  const vmBootProgress = useWorkspaceStore((s) => s.vmBootProgress)
  const vmError = useWorkspaceStore((s) => s.vmError)

  if (vmStatus === 'running') return null

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" role="status" aria-live="polite">
      {vmStatus === 'error' ? (
        <>
          <AlertCircle aria-hidden="true" className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{vmError ?? 'Failed to start workspace'}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          )}
        </>
      ) : (
        <>
          <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Starting workspace...</p>
          {vmBootProgress > 0 && vmBootProgress < 100 && (
            <div
              className="h-1.5 w-48 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={vmBootProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Workspace boot progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${vmBootProgress}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
