import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapLibreLazy } from '@/components/gis/MapLibreLazy'
import { fetchWeatherBaseline, fetchWeatherAnomaly } from '@/api/weather'


const WEATHER_LOCATIONS = [
  { id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 },
  { id: 'chicago', name: 'Chicago', lat: 41.88, lon: -87.63 },
  { id: 'houston', name: 'Houston', lat: 29.76, lon: -95.37 },
  { id: 'dallas', name: 'Dallas', lat: 32.78, lon: -96.80 },
  { id: 'atlanta', name: 'Atlanta', lat: 33.75, lon: -84.39 },
  { id: 'boston', name: 'Boston', lat: 42.36, lon: -71.06 },
  { id: 'philadelphia', name: 'Philadelphia', lat: 39.95, lon: -75.17 },
  { id: 'detroit', name: 'Detroit', lat: 42.33, lon: -83.05 },
  { id: 'minneapolis', name: 'Minneapolis', lat: 44.98, lon: -93.27 },
  { id: 'denver', name: 'Denver', lat: 39.74, lon: -104.99 },
  { id: 'london', name: 'London', lat: 51.51, lon: -0.13 },
  { id: 'rotterdam', name: 'Rotterdam', lat: 51.92, lon: 4.48 },
  { id: 'singapore', name: 'Singapore', lat: 1.35, lon: 103.82 },
  { id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.65 },
  { id: 'shanghai', name: 'Shanghai', lat: 31.23, lon: 121.47 },
  { id: 'corn_belt_ia', name: 'Iowa Corn Belt', lat: 42.0, lon: -93.5 },
  { id: 'corn_belt_il', name: 'Illinois Corn Belt', lat: 40.0, lon: -89.0 },
  { id: 'wheat_ks', name: 'Kansas Wheat Belt', lat: 38.5, lon: -98.5 },
]

function anomalyColor(category?: string): string {
  switch (category) {
    case 'extreme_warm': return '#ef4444'
    case 'extreme_cold': return '#3b82f6'
    case 'moderate': return '#f59e0b'
    default: return '#22c55e'
  }
}

export function WeatherSignalsTab() {
  const [selectedLocation, setSelectedLocation] = useState('nyc')

  const { data: anomalyData } = useQuery({
    queryKey: ['weather', 'anomaly', selectedLocation],
    queryFn: () => fetchWeatherAnomaly(selectedLocation),
    refetchInterval: 60 * 60 * 1000,
  })

  const { data: baselineData } = useQuery({
    queryKey: ['weather', 'baseline', selectedLocation],
    queryFn: () => fetchWeatherBaseline(selectedLocation),
    staleTime: 60 * 60 * 1000,
  })

  const anomaly = anomalyData?.data || anomalyData
  const baseline = baselineData?.data || []

  const markers = WEATHER_LOCATIONS.map((loc) => ({
    id: loc.id,
    lng: loc.lon,
    lat: loc.lat,
    color: loc.id === selectedLocation ? '#ffffff' : anomalyColor(undefined),
    popup: loc.name,
  }))

  const selectedLoc = WEATHER_LOCATIONS.find((l) => l.id === selectedLocation)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full p-4">
      {/* Map */}
      <div className="lg:col-span-3 h-[500px] lg:h-full rounded-lg overflow-hidden border">
        <MapLibreLazy
          center={[-40, 25]}
          zoom={2.5}
          markers={markers}
          onMarkerClick={setSelectedLocation}
        />
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-2 flex flex-col gap-3 overflow-y-auto">
        {/* Location header */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium">
            {selectedLoc?.name || selectedLocation}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedLoc?.lat.toFixed(2)}°N, {selectedLoc?.lon.toFixed(2)}°E
          </p>
        </div>

        {/* Anomaly card */}
        {anomaly && (
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Temperature Anomaly</h3>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  {anomaly.forecast_temp_c != null ? `${anomaly.forecast_temp_c.toFixed(1)}°C` : '—'}
                </span>
                <span className="text-sm text-muted-foreground">forecast</span>
              </div>
              {anomaly.baseline_temp_c != null && (
                <div className="text-sm text-muted-foreground">
                  Baseline: {anomaly.baseline_temp_c.toFixed(1)}°C (10-year avg)
                </div>
              )}
              {anomaly.anomaly_c != null && (
                <div className={`text-sm font-medium ${anomaly.anomaly_c > 0 ? 'text-red-500' : anomaly.anomaly_c < 0 ? 'text-blue-500' : ''}`}>
                  Anomaly: {anomaly.anomaly_c > 0 ? '+' : ''}{anomaly.anomaly_c.toFixed(1)}°C
                  {anomaly.z_score != null && ` (z=${anomaly.z_score.toFixed(2)})`}
                </div>
              )}
              {anomaly.anomaly_category && (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: anomalyColor(anomaly.anomaly_category) }}
                  />
                  <span className="text-sm">{anomaly.anomaly_category.replace('_', ' ')}</span>
                </div>
              )}
              {anomaly.interpretation && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {anomaly.interpretation}
                </p>
              )}
            </div>
          </div>
        )}

        {/* HDD/CDD placeholder */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">HDD/CDD Forecast (7 days)</h3>
          <p className="text-xs text-muted-foreground">
            Use <code>/weather hdd-cdd {selectedLocation}</code> or the MCP tool
            <code>get_hdd_cdd_forecast</code> for detailed heating/cooling degree day forecasts.
          </p>
        </div>

        {/* Baseline summary */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">10-Year Baseline</h3>
          {baseline.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              {baseline.length} data points loaded for {selectedLocation}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Historical baseline data loading…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
