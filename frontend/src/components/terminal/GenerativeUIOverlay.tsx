import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { GenerativeUI } from '@/components/agent/GenerativeUI'
import { useWindowBus } from '@/hooks/useWindowBus'
import { useWindowRegistryStore } from '@/stores/windowRegistryStore'
import type { GenerativeUIPayload } from '@/types/terminal'
import type { ChartOverlayProps } from '@/types/generative-ui'

interface GenerativeUIOverlayProps {
  payload: GenerativeUIPayload | null
  onDismiss: () => void
}

export function GenerativeUIOverlay({ payload, onDismiss }: GenerativeUIOverlayProps) {
  const { send } = useWindowBus()
  const linkedPairs = useWindowRegistryStore((s) => s.linkedPairs)
  const [toast, setToast] = useState<string | null>(null)

  // Dismiss on Escape
  useEffect(() => {
    if (!payload) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [payload, onDismiss])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!payload) return null

  // ChartOverlay: dispatch to linked Trading window instead of rendering locally
  if (payload.component === 'ChartOverlay') {
    const overlayProps = payload.props as ChartOverlayProps
    const linked = linkedPairs[0] // Use first linked pair

    if (linked) {
      // Dispatch to Trading window
      send({
        type: 'CHART_OVERLAY',
        targetTicker: linked.ticker,
        overlay: {
          label: overlayProps.label,
          data: overlayProps.data,
          color: overlayProps.color,
          type: overlayProps.type,
        },
      })
      setToast('Chart overlay sent to Trading window')
      onDismiss()
      return toast ? (
        <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground shadow">
          {toast}
        </div>
      ) : null
    }
    // No linked window — fall through to render locally
  }

  return (
    <>
      <div
        className="absolute left-0 top-4 z-50 max-h-[60vh] w-full max-w-[480px] -translate-x-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
        role="dialog"
        aria-label={`${payload.component} overlay`}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{payload.component}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Dismiss overlay"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-3">
          <GenerativeUI component={payload.component} props={payload.props as Record<string, unknown>} />
        </div>
      </div>
      {toast && (
        <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground shadow">
          {toast}
        </div>
      )}
    </>
  )
}
