import { useEffect, useCallback } from 'react'
import { useAgentOverlayStore } from '@/stores/agentOverlayStore'
import { ApprovalGate } from '@/components/agent/ApprovalGate'

interface ApprovalGateOverlayProps {
  resolveApproval: (requestId: string, decision: 'approved' | 'denied') => void
}

/**
 * Modal overlay wrapper for ApprovalGate.
 * Renders when Channel 2 delivers APPROVAL_REQUEST events.
 * Blocks terminal interaction until resolved (safety-critical).
 * Only rendered for agentii tabs.
 */
export function ApprovalGateOverlay({ resolveApproval }: ApprovalGateOverlayProps) {
  const approvalQueue = useAgentOverlayStore((s) => s.approvalQueue)
  const currentApproval = approvalQueue[0] ?? null

  // Keyboard: Enter = Approve, Escape = Deny
  useEffect(() => {
    if (!currentApproval) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        resolveApproval(currentApproval.requestId, 'approved')
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        resolveApproval(currentApproval.requestId, 'denied')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentApproval, resolveApproval])

  if (!currentApproval) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Approval required"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl">
        <ApprovalGate
          approval={currentApproval}
          onResolve={resolveApproval}
        />
        {approvalQueue.length > 1 && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            +{approvalQueue.length - 1} more pending
          </p>
        )}
      </div>
    </div>
  )
}
