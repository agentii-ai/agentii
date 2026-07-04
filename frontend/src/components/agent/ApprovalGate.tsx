import { useState, useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'
import type { ApprovalRequestPayload } from '@/types/terminal'

interface ApprovalGateProps {
  approval: ApprovalRequestPayload
  onResolve: (requestId: string, decision: 'approved' | 'denied') => void
}

export function ApprovalGate({ approval, onResolve }: ApprovalGateProps) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((approval.expiresAt - Date.now()) / 1000)))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [approval.expiresAt])

  return (
    <div className="rounded border border-amber-500/50 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-amber-500">Approval Required</span>
        <span className="ml-auto text-xs text-muted-foreground">{remaining}s</span>
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{approval.command}</p>
      {approval.description && (
        <p className="mt-1 text-xs text-muted-foreground">{approval.description}</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onResolve(approval.requestId, 'approved')}
          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={() => onResolve(approval.requestId, 'denied')}
          className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Deny
        </button>
      </div>
    </div>
  )
}
