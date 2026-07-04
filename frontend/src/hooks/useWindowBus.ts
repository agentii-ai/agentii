import { useCallback } from 'react'
import type { WindowMessage } from '@/types/ide'

const isTauri = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI__

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel('agentii-window-bus')
  }
  return channel
}

export function useWindowBus() {
  const send = useCallback((message: WindowMessage) => {
    if (isTauri) {
      import('@tauri-apps/api/event').then(({ emit }) => {
        emit('agentii:window-message', message)
      })
    } else {
      getChannel().postMessage(message)
    }
  }, [])

  const subscribe = useCallback((handler: (message: WindowMessage) => void): (() => void) => {
    if (isTauri) {
      let unlisten: (() => void) | null = null
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<WindowMessage>('agentii:window-message', (event) => {
          handler(event.payload)
        }).then((fn) => { unlisten = fn })
      })
      return () => { unlisten?.() }
    }

    const ch = getChannel()
    const listener = (ev: MessageEvent) => handler(ev.data as WindowMessage)
    ch.addEventListener('message', listener)
    return () => ch.removeEventListener('message', listener)
  }, [])

  return { send, subscribe }
}
