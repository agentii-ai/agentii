interface AnomalyCardProps {
  data: {
    forecast_temp_c?: number
    baseline_temp_c?: number
    anomaly_c?: number
    z_score?: number
    anomaly_category?: string
    energy_signal?: string
    interpretation?: string
  } | null
}

function anomalyColor(category?: string): string {
  switch (category) {
    case 'extreme_warm': return '#ef4444'
    case 'extreme_cold': return '#3b82f6'
    case 'moderate': return '#f59e0b'
    default: return '#22c55e'
  }
}

function categoryLabel(category?: string): string {
  switch (category) {
    case 'extreme_warm': return 'Extreme Warm'
    case 'extreme_cold': return 'Extreme Cold'
    case 'moderate': return 'Moderate'
    default: return 'Normal'
  }
}

export function AnomalyCard({ data }: AnomalyCardProps) {
  if (!data) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">Temperature Anomaly</h3>
        <p className="text-sm text-muted-foreground">No anomaly data available</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3">Temperature Anomaly</h3>
      <div className="space-y-2.5">
        {/* Forecast vs baseline */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">
            {data.forecast_temp_c != null ? `${data.forecast_temp_c.toFixed(1)}°C` : '—'}
          </span>
          <span className="text-sm text-muted-foreground">forecast</span>
        </div>

        {data.baseline_temp_c != null && (
          <div className="text-sm text-muted-foreground">
            Baseline: {data.baseline_temp_c.toFixed(1)}°C (10-year avg)
          </div>
        )}

        {/* Anomaly value */}
        {data.anomaly_c != null && (
          <div className={`text-sm font-medium ${data.anomaly_c > 0 ? 'text-red-500' : data.anomaly_c < 0 ? 'text-blue-500' : ''}`}>
            {data.anomaly_c > 0 ? '+' : ''}{data.anomaly_c.toFixed(1)}°C
            {data.z_score != null && (
              <span className="text-muted-foreground font-normal ml-1">
                (z = {data.z_score.toFixed(2)})
              </span>
            )}
          </div>
        )}

        {/* Category badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: anomalyColor(data.anomaly_category) }}
          />
          <span className="text-sm">{categoryLabel(data.anomaly_category)}</span>
          {data.energy_signal && data.energy_signal !== 'neutral' && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {data.energy_signal.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Interpretation */}
        {data.interpretation && (
          <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t">
            {data.interpretation}
          </p>
        )}
      </div>
    </div>
  )
}
