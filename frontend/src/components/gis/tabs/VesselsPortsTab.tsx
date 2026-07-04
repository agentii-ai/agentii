import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapLibreLazy } from '@/components/gis/MapLibreLazy'
import { fetchVessels, fetchPorts } from '@/api/gis'

export function VesselsPortsTab() {
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null)

  const { data: vesselsData, isLoading: vesselsLoading } = useQuery({
    queryKey: ['gis', 'vessels'],
    queryFn: () => fetchVessels({ vessel_type: 'tanker', limit: 5000 }),
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: portsData } = useQuery({
    queryKey: ['gis', 'ports'],
    queryFn: () => fetchPorts(),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const vessels = vesselsData?.data || []
  const ports = portsData?.data || []

  const markers = vessels.map((v: any) => ({
    id: String(v.mmsi),
    lng: v.longitude,
    lat: v.latitude,
    color: v.speed_knots < 1 ? '#ef4444' : '#3b82f6',
    popup: `${v.vessel_name || 'Unknown'} (${v.mmsi})`,
  }))

  const selected = selectedVessel
    ? vessels.find((v: any) => String(v.mmsi) === selectedVessel)
    : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full p-4">
      {/* Map */}
      <div className="lg:col-span-3 h-[500px] lg:h-full rounded-lg overflow-hidden border">
        <MapLibreLazy
          center={[-40, 25]}
          zoom={2.5}
          markers={markers}
          onMarkerClick={setSelectedVessel}
        />
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-2 flex flex-col gap-3 overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Active Tankers</div>
            <div className="text-2xl font-semibold">{vessels.length}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Ports Tracked</div>
            <div className="text-2xl font-semibold">{ports.length}</div>
          </div>
        </div>

        {/* Selected vessel detail */}
        {selected && (
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">
              {selected.vessel_name || `MMSI ${selected.mmsi}`}
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">MMSI</dt>
              <dd>{selected.mmsi}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{selected.vessel_type || selected.vessel_type_category}</dd>
              <dt className="text-muted-foreground">Speed</dt>
              <dd>{selected.speed_knots?.toFixed(1)} kn</dd>
              <dt className="text-muted-foreground">Heading</dt>
              <dd>{selected.heading_degrees?.toFixed(0)}°</dd>
              <dt className="text-muted-foreground">Destination</dt>
              <dd>{selected.destination || selected.current_destination || '—'}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{selected.speed_knots < 1 ? 'Anchored' : 'Underway'}</dd>
            </dl>
          </div>
        )}

        {/* Placeholder for graph explorer (Phase 5) */}
        <div className="border rounded-lg p-4 h-[250px] flex items-center justify-center text-sm text-muted-foreground">
          Port visit graph (coming in Phase 5)
        </div>

        {vesselsLoading && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Loading vessel positions…
          </div>
        )}
      </div>
    </div>
  )
}
