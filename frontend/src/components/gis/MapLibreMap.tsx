/**
 * MapLibreMap — thin React ref wrapper around raw MapLibre GL JS.
 *
 * Architecture follows react-maplibre-standalone pattern:
 * - Single useRef map instance, never re-render the map container
 * - All data updates via map.getSource().setData() (no React re-renders)
 * - Native MapLibre clustering for 50k+ points (zero JS-side cost)
 * - CARTO dark-matter free basemap (no API token)
 * - Proper cleanup: remove event listeners + map.remove() on unmount
 */

import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapMarker {
  id: string
  lng: number
  lat: number
  color?: string
  popup?: string
}

export interface GeoJSONLayer {
  id: string
  data: GeoJSON.FeatureCollection
  type: 'circle' | 'fill' | 'line'
  paint?: Record<string, unknown>
}

export interface MapLibreMapProps {
  center?: [number, number]
  zoom?: number
  markers?: MapMarker[]
  geojsonLayers?: GeoJSONLayer[]
  onMarkerClick?: (id: string) => void
  className?: string
  /** Enable native clustering for large marker sets (default: true) */
  cluster?: boolean
  clusterMaxZoom?: number
  clusterRadius?: number
}

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MARKERS_SOURCE = 'markers-src'
const MARKERS_LAYER = 'markers-layer'
const CLUSTERS_LAYER = 'clusters-layer'
const CLUSTER_COUNT_LAYER = 'cluster-count-layer'

export default function MapLibreMap({
  center = [0, 20],
  zoom = 2,
  markers = [],
  geojsonLayers = [],
  onMarkerClick,
  className = '',
  cluster = true,
  clusterMaxZoom = 10,
  clusterRadius = 50,
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onMarkerClickRef = useRef(onMarkerClick)

  // Keep callback ref fresh without re-running effects
  onMarkerClickRef.current = onMarkerClick

  // ── Mount map once, never re-create ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP,
      center,
      zoom,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

    map.on('load', () => {
      mapRef.current = map

      // Add empty markers source with clustering config
      map.addSource(MARKERS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster,
        clusterMaxZoom,
        clusterRadius,
      })

      // Cluster circles
      map.addLayer({
        id: CLUSTERS_LAYER,
        type: 'circle',
        source: MARKERS_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#3b82f6', 100,
            '#f59e0b', 500,
            '#ef4444',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            15, 100, 20, 500, 25,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })

      // Cluster count labels
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: MARKERS_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      // Individual markers (unclustered)
      map.addLayer({
        id: MARKERS_LAYER,
        type: 'circle',
        source: MARKERS_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3, 8, 6, 14, 10],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85,
        },
      })

      // Click handler for individual markers
      map.on('click', MARKERS_LAYER, (e) => {
        const feature = e.features?.[0]
        const id = feature?.properties?.id
        if (id && onMarkerClickRef.current) {
          onMarkerClickRef.current(id as string)
        }
      })

      // Click handler for clusters — zoom in
      map.on('click', CLUSTERS_LAYER, (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTERS_LAYER] })
        const clusterId = features[0]?.properties?.cluster_id
        if (clusterId == null) return
        const source = map.getSource(MARKERS_SOURCE) as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          })
        })
      })

      // Cursor changes
      map.on('mouseenter', MARKERS_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', MARKERS_LAYER, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', CLUSTERS_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', CLUSTERS_LAYER, () => {
        map.getCanvas().style.cursor = ''
      })
    })

    return () => {
      mapRef.current = null
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update markers via setData (no React re-render of map) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(MARKERS_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: markers.map((m) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [m.lng, m.lat] },
        properties: { id: m.id, color: m.color || '#3b82f6', popup: m.popup || '' },
      })),
    }

    source.setData(geojson)
  }, [markers])

  // ── Update GeoJSON layers ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const layer of geojsonLayers) {
      const layerId = `${layer.id}-layer`
      const existing = map.getSource(layer.id) as maplibregl.GeoJSONSource | undefined

      if (existing) {
        existing.setData(layer.data)
      } else {
        map.addSource(layer.id, { type: 'geojson', data: layer.data })
        map.addLayer({
          id: layerId,
          type: layer.type,
          source: layer.id,
          paint: (layer.paint || defaultPaint(layer.type)) as any,
        })
      }
    }
  }, [geojsonLayers])

  return <div ref={containerRef} className={`w-full h-full min-h-[400px] ${className}`} />
}

function defaultPaint(type: string): Record<string, unknown> {
  switch (type) {
    case 'circle':
      return { 'circle-radius': 5, 'circle-color': '#3b82f6' }
    case 'fill':
      return { 'fill-color': '#3b82f6', 'fill-opacity': 0.3, 'fill-outline-color': '#2563eb' }
    case 'line':
      return { 'line-color': '#3b82f6', 'line-width': 2 }
    default:
      return {}
  }
}
