import { useMemo } from 'react'
import { MapLibreLazy } from '@/components/gis/MapLibreLazy'

interface GISMapViewerProps {
  content: string
  filename: string
}

export function GISMapViewer({ content, filename }: GISMapViewerProps) {
  const geojson = useMemo(() => {
    try {
      const parsed = JSON.parse(content)
      if (parsed.type === 'FeatureCollection' || parsed.type === 'Feature') {
        return parsed.type === 'Feature'
          ? { type: 'FeatureCollection' as const, features: [parsed] }
          : parsed
      }
      return null
    } catch {
      return null
    }
  }, [content])

  if (!geojson) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Invalid GeoJSON file. Open in code editor instead.
      </div>
    )
  }

  const featureCount = geojson.features?.length || 0

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b text-sm text-muted-foreground flex items-center gap-2">
        <span>{filename}</span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{featureCount} features</span>
      </div>
      <div className="flex-1">
        <MapLibreLazy
          geojsonLayers={[
            {
              id: 'file-data',
              data: geojson,
              type: inferLayerType(geojson),
              paint: inferPaint(geojson),
            },
          ]}
        />
      </div>
    </div>
  )
}

function inferLayerType(geojson: GeoJSON.FeatureCollection): 'circle' | 'fill' | 'line' {
  const geomType = geojson.features?.[0]?.geometry?.type
  if (geomType === 'Point' || geomType === 'MultiPoint') return 'circle'
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 'fill'
  return 'line'
}

function inferPaint(geojson: GeoJSON.FeatureCollection): Record<string, unknown> {
  const type = inferLayerType(geojson)
  if (type === 'circle') return { 'circle-radius': 5, 'circle-color': '#3b82f6', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
  if (type === 'fill') return { 'fill-color': '#3b82f6', 'fill-opacity': 0.3, 'fill-outline-color': '#2563eb' }
  return { 'line-color': '#3b82f6', 'line-width': 2 }
}
