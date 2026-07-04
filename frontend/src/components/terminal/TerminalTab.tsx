import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useTerminal } from '@/hooks/useTerminal'
import { TerminalWriteCoalescer } from '@/lib/terminal-write-coalescer'
import type { TerminalSession } from '@/types/terminal'

import '@xterm/xterm/css/xterm.css'

interface TerminalTabProps {
  session: TerminalSession
  onTerminalReady?: (terminal: Terminal) => void
}

export function TerminalTab({ session, onTerminalReady }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const coalescerRef = useRef<TerminalWriteCoalescer | null>(null)
  const initializedRef = useRef(false)

  const handleData = useCallback((data: string) => {
    coalescerRef.current?.write(data)
  }, [])

  const { write, resize, isConnected } = useTerminal({
    sessionId: session.id,
    onData: handleData,
  })

  // Initialize xterm instance
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        selectionBackground: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      allowProposedApi: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)

    // Try WebGL renderer, fall back to canvas
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
    } catch {
      // Canvas renderer is the default fallback — no action needed
    }

    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    coalescerRef.current = new TerminalWriteCoalescer((data) => terminal.write(data))

    // Expose Terminal instance to parent
    onTerminalReady?.(terminal)

    // Forward user input to backend
    terminal.onData((data) => {
      write(data)
    })

    // Report initial size
    resize({ rows: terminal.rows, cols: terminal.cols })

    return () => {
      coalescerRef.current?.dispose()
      coalescerRef.current = null
      initializedRef.current = false
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [write, resize, onTerminalReady])

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container || !fitAddonRef.current) return

    const observer = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit()
        const term = terminalRef.current
        if (term) {
          resize({ rows: term.rows, cols: term.cols })
        }
      } catch {
        // Ignore fit errors during rapid resizing
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [resize])

  // Show connection status in terminal
  useEffect(() => {
    if (!terminalRef.current) return
    if (session.status === 'exited') {
      terminalRef.current.write(
        `\r\n\x1b[90m[Process exited${session.exitCode !== undefined ? ` with code ${session.exitCode}` : ''}]\x1b[0m\r\n`,
      )
    }
  }, [session.status, session.exitCode])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      data-session-id={session.id}
      data-connected={isConnected}
    />
  )
}
