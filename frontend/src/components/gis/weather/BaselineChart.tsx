interface BaselineChartProps {
  data?: Array<{
    timestamp?: string
    date?: string
    temperature_c?: number
    avg_temperature_c?: number
  }>
  locationId: string
}

export function BaselineChart({ data, locationId }: BaselineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">10-Year Baseline</h3>
        <p className="text-sm text-muted-foreground">
          Historical baseline data loading for {locationId}…
        </p>
      </div>
    )
  }

  // Simple text-based summary until lightweight-charts integration
  const temps = data
    .map((d) => d.temperature_c ?? d.avg_temperature_c)
    .filter((t): t is number => t != null)

  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const avg = temps.reduce((a, b) => a + b, 0) / temps.length

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3">10-Year Baseline — {locationId}</h3>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Min</div>
          <div className="text-lg font-semibold text-blue-500">{min.toFixed(1)}°C</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Avg</div>
          <div className="text-lg font-semibold">{avg.toFixed(1)}°C</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Max</div>
          <div className="text-lg font-semibold text-red-500">{max.toFixed(1)}°C</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {data.length.toLocaleString()} observations (2016–present)
      </div>
    </div>
  )
}
