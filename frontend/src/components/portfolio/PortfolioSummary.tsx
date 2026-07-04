import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Portfolio } from '@/types/portfolio'

interface PortfolioSummaryProps {
  portfolio: Portfolio
}

export function PortfolioSummary({ portfolio }: PortfolioSummaryProps) {
  const p = portfolio
  const pnlPositive = p.total_unrealized_pnl >= 0

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Market Value</div>
          <div className="text-lg font-semibold">{formatCurrency(p.total_market_value)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Unrealized P&L</div>
          <div className={cn('text-lg font-semibold', pnlPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {formatCurrency(p.total_unrealized_pnl)}
          </div>
          <div className={cn('text-xs', pnlPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {formatPercent(p.total_unrealized_pnl_pct)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Cash / Buying Power</div>
          <div className="text-lg font-semibold">{formatCurrency(p.cash_balance)}</div>
          <div className="text-xs text-muted-foreground">{formatCurrency(p.buying_power)} BP</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Net Greeks</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mt-1">
            <span className="text-muted-foreground">Δ Delta</span>
            <span className="text-right font-medium">{formatNumber(p.net_greeks.delta, 1)}</span>
            <span className="text-muted-foreground">Γ Gamma</span>
            <span className="text-right font-medium">{formatNumber(p.net_greeks.gamma, 1)}</span>
            <span className="text-muted-foreground">Θ Theta</span>
            <span className="text-right font-medium">{formatNumber(p.net_greeks.theta, 1)}</span>
            <span className="text-muted-foreground">ν Vega</span>
            <span className="text-right font-medium">{formatNumber(p.net_greeks.vega, 1)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
