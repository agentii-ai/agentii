import { useCallback, useEffect, useRef, useState } from 'react'
import { useTerminalStore } from '@/stores/terminalStore'
import { GATEWAY_WS_URL } from '@/config/gateway'

interface UseTerminalWebSocketOptions {
  terminalId: string
  projectId?: string | null
  cli?: string
  onData: (data: Uint8Array) => void
  onClose?: () => void
}

/** CLIs that need TERM=xterm to avoid escape sequence rendering issues in xterm.js */
const TERM_XTERM_CLIS = new Set(['goose'])

export function useTerminalWebSocket({ terminalId, projectId, cli, onData, onClose }: UseTerminalWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const setTabStatus = useTerminalStore((s) => s.setTabStatus)

  // Store callbacks in refs so the WebSocket effect doesn't re-run when
  // the caller passes a new function identity (React Strict Mode double-mount).
  const onDataRef = useRef(onData)
  const onCloseRef = useRef(onClose)
  onDataRef.current = onData
  onCloseRef.current = onClose

  useEffect(() => {
    if (!terminalId || !projectId) return

    let cancelled = false

    let url = `${GATEWAY_WS_URL}/ws/terminal/${projectId}/${terminalId}`
    const resolvedCli = cli ?? useTerminalStore.getState().tabs.find(t => t.id === terminalId)?.cli
    const params = new URLSearchParams()
    if (resolvedCli && resolvedCli !== 'bash') {
      params.set('cli', resolvedCli)
    }
    // Goose (reedline) emits aggressive cursor-repositioning escape sequences under
    // xterm-256color that cause rendering artifacts in xterm.js due to wcwidth mismatch.
    // TERM=xterm forces reedline into a simpler rendering path.
    if (resolvedCli && TERM_XTERM_CLIS.has(resolvedCli)) {
      params.set('term', 'xterm')
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      if (cancelled) { ws.close(); return }
      setConnected(true)
      setTabStatus(terminalId, 'running')
    }

    ws.onmessage = (event) => {
      if (cancelled) return
      if (event.data instanceof ArrayBuffer) {
        onDataRef.current(new Uint8Array(event.data))
      } else if (typeof event.data === 'string') {
        // Filter out JSON-RPC responses (e.g., terminal.resize ack) —
        // these are protocol messages, not PTY output.
        try {
          const parsed = JSON.parse(event.data)
          if (parsed && parsed.type === 'res') {
            // Silently consume RPC responses
            return
          }
        } catch {
          // Not JSON — treat as PTY text output
        }
        const encoder = new TextEncoder()
        onDataRef.current(encoder.encode(event.data))
      }
    }

    ws.onclose = () => {
      if (cancelled) return
      setConnected(false)
      setTabStatus(terminalId, 'exited')
      onCloseRef.current?.()
    }

    ws.onerror = () => {
      if (cancelled) return
      setConnected(false)
      setTabStatus(terminalId, 'exited')
    }

    return () => {
      cancelled = true
      // Only close if the handshake completed; closing a CONNECTING socket
      // logs a noisy browser warning and races with the backend PTY lifecycle.
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
        ws.close()
      } else {
        // Still CONNECTING — defer close until the handshake finishes (or fails).
        ws.onopen = () => ws.close()
      }
      wsRef.current = null
    }
    // Deps: only re-connect when the terminal or project actually changes.
    // Callbacks are accessed via refs so they don't trigger reconnects.
  }, [terminalId, projectId, setTabStatus])

  const sendData = useCallback(
    (data: string | Uint8Array) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      if (typeof data === 'string') {
        ws.send(new TextEncoder().encode(data))
      } else {
        ws.send(data)
      }
    },
    [],
  )

  const sendResize = useCallback(
    (cols: number, rows: number) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      const msg = JSON.stringify({
        type: 'req',
        id: crypto.randomUUID(),
        method: 'terminal.resize',
        params: { terminal_id: terminalId, cols, rows },
      })
      ws.send(msg)
    },
    [terminalId],
  )

  return { connected, sendData, sendResize }
}
