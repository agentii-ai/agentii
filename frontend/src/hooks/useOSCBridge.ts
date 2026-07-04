import { useEffect, useRef } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { GenerativeUIPayload } from '@/types/terminal'
import { OSC_CODE } from '@/types/terminal'

interface UseOSCBridgeOptions {
  terminal: Terminal | null
  onPayload: (payload: GenerativeUIPayload) => void
}

/**
 * Registers an OSC 7777 handler on the xterm.js Terminal instance.
 * When the Ratatui TUI emits `\x1b]7777;<JSON>\x1b\\`, this hook
 * parses the JSON and dispatches it to the onPayload callback.
 */
export function useOSCBridge({ terminal, onPayload }: UseOSCBridgeOptions) {
  const onPayloadRef = useRef(onPayload)
  onPayloadRef.current = onPayload

  useEffect(() => {
    if (!terminal) return

    const disposable = terminal.parser.registerOscHandler(OSC_CODE, (data: string) => {
      try {
        const payload = JSON.parse(data) as GenerativeUIPayload
        if (payload && typeof payload.component === 'string') {
          onPayloadRef.current(payload)
        }
      } catch {
        // Ignore malformed OSC payloads
      }
      return true
    })

    return () => {
      disposable.dispose()
    }
  }, [terminal])
}
