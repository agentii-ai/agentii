import { cn } from '@/lib/utils'
import type { FinancialTableProps } from '@/types/generative-ui'

export function FinancialTable({ title, columns, rows, highlightRows = [] }: FinancialTableProps) {
  return (
    <div className="my-2 overflow-x-auto rounded border border-border">
      {title && <div className="border-b border-border px-3 py-1.5 text-xs font-medium">{title}</div>}
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-1.5 text-left font-medium text-muted-foreground',
                  (col.type === 'number' || col.type === 'percent' || col.type === 'currency') && 'text-right',
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={cn('border-t border-border', highlightRows.includes(ri) && 'bg-primary/5')}
            >
              {columns.map((col) => {
                const val = row[col.key]
                const num = typeof val === 'number' ? val : parseFloat(String(val ?? ''))
                const isNum = col.type !== 'text' && !isNaN(num)
                return (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-1.5',
                      isNum && 'text-right font-mono',
                      isNum && num > 0 && 'text-green-500',
                      isNum && num < 0 && 'text-red-500',
                    )}
                  >
                    {col.type === 'currency' && isNum
                      ? `$${num.toLocaleString()}`
                      : col.type === 'percent' && isNum
                        ? `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
                        : String(val ?? '')}
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
