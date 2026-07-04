import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type GuardStatus = 'checking' | 'ok' | 'duplicate'

/**
 * Detects when the same project IDE is open in multiple browser tabs.
 *
 * Returns a status:
 * - 'checking': waiting for other tabs to respond (brief, ~150ms)
 * - 'ok': no other tab has this project open
 * - 'duplicate': another tab already has this project open
 *
 * IMPORTANT: The caller must NOT render the IDE/terminal until status !== 'checking'.
 * This prevents the duplicate tab from creating WebSocket connections that interfere
 * with the existing tab's PTY sessions.
 */
export function useDuplicateTabGuard(projectId: string | null): { status: GuardStatus } {
  const tabId = useRef(`tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const [status, setStatus] = useState<GuardStatus>(projectId ? 'checking' : 'ok')

  useEffect(() => {
    if (!projectId) {
      setStatus('ok')
      return
    }

    setStatus('checking')

    const channel = new BroadcastChannel('agentii-ide-guard')
    const myTabId = tabId.current
    let settled = false

    channel.onmessage = (ev) => {
      const msg = ev.data
      if (!msg || !msg.type) return

      if (msg.type === 'IDE_PROJECT_CLAIM' && msg.projectId === projectId && msg.tabId !== myTabId) {
        // Another tab is trying to open the same project — tell it we're here
        channel.postMessage({
          type: 'IDE_PROJECT_CLAIMED',
          projectId,
          tabId: myTabId,
        })
      }

      if (msg.type === 'IDE_PROJECT_CLAIMED' && msg.projectId === projectId && msg.tabId !== myTabId) {
        // An existing tab already has this project open
        settled = true
        setStatus('duplicate')
        toast.warning('This project is already open in another tab', {
          description: 'Only one tab can control the terminal at a time.',
          duration: 8000,
          action: {
            label: 'Switch to it',
            onClick: () => {
              channel.postMessage({ type: 'IDE_FOCUS_REQUEST', tabId: msg.tabId })
              window.location.href = '/projects'
            },
          },
        })
      }

      if (msg.type === 'IDE_FOCUS_REQUEST' && msg.tabId === myTabId) {
        window.focus()
      }
    }

    // Broadcast our claim
    channel.postMessage({
      type: 'IDE_PROJECT_CLAIM',
      projectId,
      tabId: myTabId,
    })

    // If no response within 200ms, we're the only tab — proceed
    const timer = setTimeout(() => {
      if (!settled) {
        setStatus('ok')
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      channel.close()
    }
  }, [projectId])

  return { status }
}
