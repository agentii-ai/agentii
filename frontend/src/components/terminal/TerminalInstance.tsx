import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { useTerminalWebSocket } from '@/hooks/useTerminalWebSocket'
import { TerminalWriteCoalescer } from '@/lib/terminal-write-coalescer'

interface TerminalInstanceProps {
  terminalId: string
  projectId?: string | null
  cli?: string
  isActive: boolean
  onTerminalReady?: (terminal: Terminal) => void
}

export function TerminalInstance({ terminalId, projectId, cli, isActive, onTerminalReady }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const coalescerRef = useRef<TerminalWriteCoalescer | null>(null)
  const onTerminalReadyRef = useRef(onTerminalReady)
  onTerminalReadyRef.current = onTerminalReady

  const handleData = useCallback((data: Uint8Array) => {
    coalescerRef.current?.write(data)
  }, [])

  const { connected, sendData, sendResize } = useTerminalWebSocket({
    terminalId,
    projectId,
    cli,
    onData: handleData,
  })

  // Store WS send functions in refs so the Terminal creation effect doesn't
  // re-run when their identity changes (React Strict Mode double-mount).
  const sendDataRef = useRef(sendData)
  const sendResizeRef = useRef(sendResize)
  sendDataRef.current = sendData
  sendResizeRef.current = sendResize

  // Send initial resize once WebSocket connects, since the fit() at mount
  // fires before the WS is open and the resize gets silently dropped.
  // Use a small delay to ensure CSS layout has settled.
  useEffect(() => {
    if (connected && terminalRef.current && fitAddonRef.current) {
      // Immediate fit
      fitAddonRef.current.fit()
      const { cols, rows } = terminalRef.current
      sendResizeRef.current(cols, rows)

      // Delayed fit — catches cases where the container dimensions aren't
      // finalized yet on page load (CSS layout race).
      const timer = setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit()
          const { cols, rows } = terminalRef.current
          sendResizeRef.current(cols, rows)
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [connected])

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#0d1117',
        foreground: '#e2e8f0',
        cursor: '#e2e8f0',
        selectionBackground: '#1e3a5f',
        black: '#0d1117',
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
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)

    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL not available, canvas renderer will be used
    }

    fitAddon.fit()

    terminal.onData((data) => {
      sendDataRef.current(data)
    })

    terminal.onResize(({ cols, rows }) => {
      sendResizeRef.current(cols, rows)
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    coalescerRef.current = new TerminalWriteCoalescer((data) => terminal.write(data))

    // Expose Terminal instance to parent for OSC bridge
    onTerminalReadyRef.current?.(terminal)

    return () => {
      coalescerRef.current?.dispose()
      coalescerRef.current = null
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
    // Only re-create the Terminal when the terminalId changes (new tab).
    // WS callbacks are accessed via refs — no dependency needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId])

  // Re-fit on visibility change
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
      })
    }
  }, [isActive])

  // Re-fit on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isActive && fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isActive])

  // Re-fit when the container element changes size (e.g., terminal panel drag).
  // ResizeObserver detects CSS layout changes that window.resize misses.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      if (isActive && fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: isActive ? 'block' : 'none' }}
      data-connected={connected}
    />
  )
}
