import { cn } from '@/lib/utils'
import type { ComparisonGridProps } from '@/types/generative-ui'

export function ComparisonGrid({ companies, metrics, data }: ComparisonGridProps) {
  return (
    <div className="my-2 overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Metric</th>
            {companies.map((c) => (
              <th key={c.ticker} className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                {c.ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.key} className="border-t border-border">
              <td className="px-3 py-1.5 text-muted-foreground">{metric.label}</td>
              {companies.map((c) => {
                const val = data[c.ticker]?.[metric.key]
                const num = typeof val === 'number' ? val : NaN
                return (
                  <td
                    key={c.ticker}
                    className={cn(
                      'px-3 py-1.5 text-right font-mono',
                      !isNaN(num) && num > 0 && 'text-green-500',
                      !isNaN(num) && num < 0 && 'text-red-500',
                    )}
                  >
                    {metric.type === 'currency' && !isNaN(num)
                      ? `$${num.toLocaleString()}`
                      : metric.type === 'percent' && !isNaN(num)
                        ? `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
                        : String(val ?? '—')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
