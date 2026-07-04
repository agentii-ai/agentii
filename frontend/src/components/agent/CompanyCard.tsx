import { cn } from '@/lib/utils'
import type { CompanyCardProps } from '@/types/generative-ui'

export function CompanyCard({ ticker, name, price, change, changePercent, marketCap }: CompanyCardProps) {
  const isPositive = change >= 0

  return (
    <div className="my-2 rounded border border-border p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold">{ticker}</p>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-medium">${price.toFixed(2)}</p>
          <p className={cn('text-xs font-mono', isPositive ? 'text-green-500' : 'text-red-500')}>
            {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
          </p>
        </div>
      </div>
      {marketCap != null && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Mkt Cap: ${(marketCap / 1e9).toFixed(1)}B
        </p>
      )}
    </div>
  )
}
