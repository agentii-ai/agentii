import { useEffect, useRef, useState } from 'react'
import type { ISeriesApi, ISeriesMarkersPluginApi, Time } from 'lightweight-charts'
import { createSeriesMarkers } from 'lightweight-charts'
import { formatDate } from '@/lib/utils'
import type { CatalystMarker } from '@/hooks/useCatalystMarkers'

interface CatalystMarkersProps {
  series: ISeriesApi<'Candlestick'> | null
  markers: CatalystMarker[]
  chart?: { subscribeCrosshairMove: (handler: (param: any) => void) => void; unsubscribeCrosshairMove: (handler: (param: any) => void) => void } | null
}

export function CatalystMarkers({ series, markers, chart }: CatalystMarkersProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [hoveredMarker, setHoveredMarker] = useState<CatalystMarker | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  useEffect(() => {
    if (!series || markers.length === 0) return

    const lwcMarkers = markers.map(({ id, catalyst, ...rest }) => rest)

    if (!markersPluginRef.current) {
      markersPluginRef.current = createSeriesMarkers<Time>(series, lwcMarkers)
    } else {
      markersPluginRef.current.setMarkers(lwcMarkers)
    }

    return () => {
      if (markersPluginRef.current) {
        markersPluginRef.current.detach()
        markersPluginRef.current = null
      }
    }
  }, [series, markers])

  useEffect(() => {
    if (!chart) return

    const handleCrosshairMove = (param: any) => {
      if (!param.point || !param.time) {
        setHoveredMarker(null)
        return
      }

      const marker = markers.find((m) => m.time === param.time)
      if (marker) {
        setHoveredMarker(marker)
        setTooltipPos({ x: param.point.x, y: param.point.y })
      } else {
        setHoveredMarker(null)
      }
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
    }
  }, [chart, markers])

  if (!hoveredMarker) return null

  const catalyst = hoveredMarker.catalyst

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 pointer-events-none bg-popover border border-border rounded-md shadow-lg p-2 text-xs max-w-[250px]"
      style={{
        left: `${tooltipPos.x + 10}px`,
        top: `${tooltipPos.y - 60}px`,
      }}
    >
      <div className="font-semibold">{catalyst.drug_name}</div>
      <div className="text-muted-foreground">{catalyst.indication}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs font-medium" style={{ color: hoveredMarker.color }}>
          {catalyst.catalyst_type.replace('_', ' ').toUpperCase()}
        </span>
        <span className="text-muted-foreground">{formatDate(catalyst.event_date)}</span>
      </div>
      {catalyst.approval_probability != null && (
        <div className="text-muted-foreground mt-1">
          Approval: {Math.round(catalyst.approval_probability * 100)}%
        </div>
      )}
    </div>
  )
}
