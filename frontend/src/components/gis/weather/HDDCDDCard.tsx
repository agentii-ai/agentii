interface HDDCDDCardProps {
  data?: {
    cumulative_hdd?: number
    cumulative_cdd?: number
    forecast_days?: number
    base_temp_f?: number
    daily?: Array<{
      date: string
      avg_temp_c: number
      avg_temp_f: number
      hdd: number
      cdd: number
    }>
    interpretation?: string
  } | null
  locationId: string
}

export function HDDCDDCard({ data, locationId }: HDDCDDCardProps) {
  if (!data || !data.daily?.length) {
    return (
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">HDD/CDD Forecast</h3>
        <p className="text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 rounded">/weather hdd-cdd {locationId}</code> or
          MCP tool <code className="bg-muted px-1 rounded">get_hdd_cdd_forecast</code> for data.
        </p>
      </div>
    )
  }

  const isHeating = (data.cumulative_hdd || 0) > (data.cumulative_cdd || 0)

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3">
        HDD/CDD Forecast ({data.forecast_days || 7} days)
      </h3>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`rounded-md p-2 ${isHeating ? 'bg-blue-500/10' : 'bg-muted'}`}>
          <div className="text-xs text-muted-foreground">Heating (HDD)</div>
          <div className="text-lg font-semibold">{(data.cumulative_hdd || 0).toFixed(0)}</div>
        </div>
        <div className={`rounded-md p-2 ${!isHeating ? 'bg-red-500/10' : 'bg-muted'}`}>
          <div className="text-xs text-muted-foreground">Cooling (CDD)</div>
          <div className="text-lg font-semibold">{(data.cumulative_cdd || 0).toFixed(0)}</div>
        </div>
      </div>

      {/* Daily table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th className="pb-1">Date</th>
            <th className="pb-1 text-right">°F</th>
            <th className="pb-1 text-right">HDD</th>
            <th className="pb-1 text-right">CDD</th>
          </tr>
        </thead>
        <tbody>
          {data.daily.slice(0, 7).map((d, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="py-0.5">{d.date.slice(5)}</td>
              <td className="py-0.5 text-right">{d.avg_temp_f.toFixed(0)}</td>
              <td className={`py-0.5 text-right ${d.hdd > 0 ? 'text-blue-500' : ''}`}>
                {d.hdd > 0 ? d.hdd.toFixed(0) : '—'}
              </td>
              <td className={`py-0.5 text-right ${d.cdd > 0 ? 'text-red-500' : ''}`}>
                {d.cdd > 0 ? d.cdd.toFixed(0) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Interpretation */}
      {data.interpretation && (
        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t leading-relaxed">
          {data.interpretation}
        </p>
      )}
    </div>
  )
}
