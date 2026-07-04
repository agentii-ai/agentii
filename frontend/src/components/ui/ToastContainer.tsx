import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToastStore, type Toast } from '@/stores/toastStore'

const iconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const colorMap = {
  success: 'border-green-500/50 bg-green-500/5 text-green-400',
  warning: 'border-amber-500/50 bg-amber-500/5 text-amber-400',
  error: 'border-red-500/50 bg-red-500/5 text-red-400',
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur',
              colorMap[toast.type],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded p-0.5 hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
