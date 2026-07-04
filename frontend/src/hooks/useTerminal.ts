import { useEffect, useRef, useCallback, useState } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { isTauri } from '@/config/tauri'
import type { TerminalSize, TerminalSessionType } from '@/types/terminal'
import { useTerminalStore } from '@/stores/terminalStore'

/** Map session type to the binary/shell to spawn */
function sessionTypeToShell(type: TerminalSessionType): string | undefined {
  switch (type) {
    case 'agentii-cli': return 'agentii'
    case 'claude': return 'claude'
    case 'goose': return 'goose'
    case 'opencode': return 'opencode'
    case 'shell': return undefined // use default $SHELL
    case 'agent-output': return undefined
    default: return undefined
  }
}

/** Build env vars for a given session type */
function sessionTypeToEnv(type: TerminalSessionType, sessionId: string): Record<string, string> | undefined {
  switch (type) {
    case 'agentii-cli': return { AGENTII_SESSION_ID: sessionId }
    case 'claude': return { AGENTII_SESSION_ID: sessionId }
    // Goose uses reedline which emits aggressive cursor-repositioning escape
    // sequences under xterm-256color. Its internal wcwidth calculation for
    // emoji/Unicode in the prompt disagrees with xterm.js, causing multi-line
    // input deletion to erase visible content. TERM=xterm forces reedline into
    // a simpler rendering path while preserving colors and basic line editing.
    case 'goose': return { AGENTII_SESSION_ID: sessionId, TERM: 'xterm' }
    case 'opencode': return { AGENTII_SESSION_ID: sessionId }
    default: return undefined
  }
}

interface UseTerminalOptions {
  sessionId: string
  sessionType?: TerminalSessionType
  cwd?: string
  onData?: (data: string) => void
  onError?: (error: string) => void
}

export function useTerminal({ sessionId, sessionType = 'shell', cwd, onData, onError }: UseTerminalOptions) {
  const { status, sendRpc, onEvent } = useWebSocket()
  const [isConnected, setIsConnected] = useState(false)
  const onDataRef = useRef(onData)
  const onErrorRef = useRef(onError)
  const cleanupRef = useRef<(() => void) | null>(null)
  const attachedRef = useRef(false)
  const createdRef = useRef(false)

  onDataRef.current = onData
  onErrorRef.current = onError

  // Create + attach to terminal session via RPC
  useEffect(() => {
    if (status !== 'connected' || !sessionId || attachedRef.current) return

    let cancelled = false

    async function createAndAttach() {
      try {
        if (!createdRef.current) {
          const shell = sessionTypeToShell(sessionType)
          const env = sessionTypeToEnv(sessionType, sessionId)

          if (isTauri()) {
            const { invoke } = await import('@tauri-apps/api/core')
            await invoke('plugin:terminal|create', {
              sessionId,
              ...(shell ? { shell } : {}),
              ...(cwd ? { cwd } : {}),
              ...(env ? { env } : {}),
              type: sessionType,
            })
          } else {
            await sendRpc('terminal.create', {
              sessionId,
              ...(shell ? { shell } : {}),
              ...(cwd ? { cwd } : {}),
              ...(env ? { env } : {}),
              type: sessionType,
            })
          }
          if (cancelled) return
          createdRef.current = true
          useTerminalStore.getState().setTabStatus(sessionId, 'running')
        }

        // Attach to receive data
        if (isTauri()) {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('plugin:terminal|attach', { sessionId })
        } else {
          await sendRpc('terminal.attach', { sessionId })
        }
        if (!cancelled) {
          attachedRef.current = true
          setIsConnected(true)
        }
      } catch (err) {
        if (!cancelled) {
          setIsConnected(false)
          const message = err instanceof Error ? err.message : 'Failed to create terminal session'

          // Distinguish VM errors from CLI-not-found errors
          if (message.includes('VM') || message.includes('vm') || message.includes('timeout')) {
            useTerminalStore.getState().setVmStatus('error', message)
          }

          onErrorRef.current?.(message)
        }
      }
    }

    createAndAttach()

    return () => {
      cancelled = true
    }
  }, [status, sessionId, sessionType, cwd, sendRpc])

  // Listen for terminal data events
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onEvent('terminal.data', (payload) => {
      if (payload.sessionId === sessionId && typeof payload.data === 'string') {
        onDataRef.current?.(payload.data)
      }
    })

    cleanupRef.current = unsubscribe
    return () => {
      unsubscribe()
      cleanupRef.current = null
    }
  }, [sessionId, onEvent])

  // Listen for terminal exit events
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onEvent('terminal.exit', (payload) => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false)
        attachedRef.current = false
        useTerminalStore.getState().setTabStatus(
          sessionId,
          'exited',
          typeof payload.exitCode === 'number' ? payload.exitCode : undefined,
        )
      }
    })

    return unsubscribe
  }, [sessionId, onEvent])

  // Listen for VM status events
  useEffect(() => {
    const unsubscribe = onEvent('vm.status', (payload) => {
      const vmStatus = payload.status as string
      if (vmStatus === 'running') {
        useTerminalStore.getState().setVmStatus('running')
      } else if (vmStatus === 'error') {
        useTerminalStore.getState().setVmStatus('error', payload.error as string | undefined)
      } else if (vmStatus === 'starting') {
        useTerminalStore.getState().setVmStatus('starting')
      } else if (vmStatus === 'stopped') {
        useTerminalStore.getState().setVmStatus('stopped')
      }
    })

    return unsubscribe
  }, [onEvent])

  // Detach on unmount
  useEffect(() => {
    return () => {
      if (attachedRef.current && sessionId) {
        attachedRef.current = false
        if (isTauri()) {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('plugin:terminal|detach', { sessionId }).catch(() => {})
          })
        } else {
          sendRpc('terminal.detach', { sessionId }).catch(() => {})
        }
      }
    }
  }, [sessionId, sendRpc])

  const write = useCallback(
    (data: string) => {
      if (!sessionId) return
      if (isTauri()) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('plugin:terminal|write', { sessionId, data }).catch(() => {})
        })
      } else {
        sendRpc('terminal.write', { sessionId, data }).catch(() => {})
      }
    },
    [sessionId, sendRpc],
  )

  const resize = useCallback(
    (size: TerminalSize) => {
      if (!sessionId) return
      if (isTauri()) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('plugin:terminal|resize', { sessionId, rows: size.rows, cols: size.cols }).catch(() => {})
        })
      } else {
        sendRpc('terminal.resize', { sessionId, rows: size.rows, cols: size.cols }).catch(() => {})
      }
    },
    [sessionId, sendRpc],
  )

  return { write, resize, isConnected }
}
