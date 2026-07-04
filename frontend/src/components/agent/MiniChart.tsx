import type { MiniChartProps } from '@/types/generative-ui'

export function MiniChart({ data, type, color = '#3b82f6', height = 200, label }: MiniChartProps) {
  if (data.length === 0) return null

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const width = 400
  const padding = 8

  if (type === 'bar') {
    const barWidth = (width - padding * 2) / data.length - 2
    return (
      <div className="my-2 rounded border border-border p-2">
        {label && <p className="mb-1 text-xs font-medium">{label}</p>}
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {data.map((d, i) => {
            const barHeight = ((d.value - min) / range) * (height - padding * 2)
            const x = padding + i * ((width - padding * 2) / data.length)
            return (
              <rect
                key={i}
                x={x}
                y={height - padding - barHeight}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity={0.8}
              />
            )
          })}
        </svg>
      </div>
    )
  }

  // Line chart
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((d.value - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="my-2 rounded border border-border p-2">
      {label && <p className="mb-1 text-xs font-medium">{label}</p>}
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      </svg>
    </div>
  )
}
