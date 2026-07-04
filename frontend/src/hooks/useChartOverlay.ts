import { useEffect, useCallback } from 'react'
import { useWindowBus } from '@/hooks/useWindowBus'
import { useWindowRegistryStore } from '@/stores/windowRegistryStore'
import type { WindowMessage } from '@/types/ide'

/**
 * Hook for Trading window to handle CHART_OVERLAY messages from linked IDE windows.
 * Applies overlay data to the active Lightweight Charts instance.
 */
export function useChartOverlay(
  applyOverlay: (overlay: { label: string; data: { time: string; value: number }[]; color: string; type: string }) => void,
) {
  const { subscribe } = useWindowBus()

  useEffect(() => {
    const unsub = subscribe((msg: WindowMessage) => {
      if (msg.type === 'CHART_OVERLAY') {
        applyOverlay(msg.overlay)
      }
    })
    return unsub
  }, [subscribe, applyOverlay])
}

/**
 * Hook for Trading window to emit CHART_SELECTION messages to linked IDE windows.
 */
export function useChartSelection() {
  const { send } = useWindowBus()
  const linkedPairs = useWindowRegistryStore((s) => s.linkedPairs)

  const emitSelection = useCallback(
    (ticker: string, from: number, to: number, timeRange: [string, string]) => {
      const pair = linkedPairs.find((p) => p.ticker === ticker)
      if (!pair) return
      send({ type: 'CHART_SELECTION', sourceTicker: ticker, from, to, timeRange })
    },
    [send, linkedPairs],
  )

  return { emitSelection }
}

/**
 * Wire generative UI ChartOverlay payloads to the window bus automatically.
 */
export function useChartOverlayBridge() {
  const { send } = useWindowBus()
  const linkedPairs = useWindowRegistryStore((s) => s.linkedPairs)

  const dispatchOverlay = useCallback(
    (ticker: string, overlay: { label: string; data: { time: string; value: number }[]; color: string; type: string }) => {
      const pair = linkedPairs.find((p) => p.ticker === ticker)
      if (!pair) return
      send({
        type: 'CHART_OVERLAY',
        targetTicker: ticker,
        overlay: { ...overlay, lineWidth: 2 },
      })
    },
    [send, linkedPairs],
  )

  return { dispatchOverlay }
}
