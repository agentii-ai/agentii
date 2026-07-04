import { useEffect } from 'react'
import { useWindowBus } from '@/hooks/useWindowBus'
import { useWindowRegistryStore } from '@/stores/windowRegistryStore'
import type { WindowDescriptor, WindowMessage } from '@/types/ide'

export function useAutoLink(currentWindow: WindowDescriptor) {
  const { send, subscribe } = useWindowBus()
  const registerWindow = useWindowRegistryStore((s) => s.registerWindow)
  const removeWindow = useWindowRegistryStore((s) => s.removeWindow)
  const linkWindows = useWindowRegistryStore((s) => s.linkWindows)
  const windows = useWindowRegistryStore((s) => s.windows)
  const linkedPairs = useWindowRegistryStore((s) => s.linkedPairs)

  // Register on mount, unregister on unmount
  useEffect(() => {
    registerWindow(currentWindow)
    send({ type: 'WINDOW_OPENED', descriptor: currentWindow })

    return () => {
      removeWindow(currentWindow.windowId)
      send({ type: 'WINDOW_CLOSED', windowId: currentWindow.windowId })
    }
  }, [currentWindow, registerWindow, removeWindow, send])

  // Listen for window events and auto-link by ticker
  useEffect(() => {
    const unsub = subscribe((msg: WindowMessage) => {
      if (msg.type === 'WINDOW_OPENED') {
        registerWindow(msg.descriptor)
        tryAutoLink(msg.descriptor)
      } else if (msg.type === 'WINDOW_CLOSED') {
        removeWindow(msg.windowId)
      } else if (msg.type === 'TICKER_CHANGED') {
        const win = windows.find((w) => w.windowId === msg.windowId)
        if (win) {
          registerWindow({ ...win, ticker: msg.newTicker })
        }
      }
    })
    return unsub
  }, [subscribe, registerWindow, removeWindow, windows])

  function tryAutoLink(newWindow: WindowDescriptor) {
    if (!newWindow.ticker) return

    const allWindows = useWindowRegistryStore.getState().windows
    const pairs = useWindowRegistryStore.getState().linkedPairs

    if (newWindow.windowType === 'ide') {
      const tradingMatch = allWindows.find(
        (w) => w.windowType === 'trading' && w.ticker === newWindow.ticker
          && !pairs.some((p) => p.tradingId === w.windowId),
      )
      if (tradingMatch) {
        linkWindows(newWindow.windowId, tradingMatch.windowId, newWindow.ticker)
        send({ type: 'LINK_WINDOWS', ideWindowId: newWindow.windowId, tradingWindowId: tradingMatch.windowId, ticker: newWindow.ticker })
      }
    } else if (newWindow.windowType === 'trading') {
      const ideMatch = allWindows.find(
        (w) => w.windowType === 'ide' && w.ticker === newWindow.ticker
          && !pairs.some((p) => p.ideId === w.windowId),
      )
      if (ideMatch) {
        linkWindows(ideMatch.windowId, newWindow.windowId, newWindow.ticker)
        send({ type: 'LINK_WINDOWS', ideWindowId: ideMatch.windowId, tradingWindowId: newWindow.windowId, ticker: newWindow.ticker })
      }
    }
  }

  const isLinked = linkedPairs.some(
    (p) => p.ideId === currentWindow.windowId || p.tradingId === currentWindow.windowId,
  )

  const linkedTicker = linkedPairs.find(
    (p) => p.ideId === currentWindow.windowId || p.tradingId === currentWindow.windowId,
  )?.ticker ?? null

  return { isLinked, linkedTicker }
}
