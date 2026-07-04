import { Card, CardContent } from '@/components/ui/card'
import { formatCompactNumber } from '@/lib/utils'

interface OptionsAnalysisProps {
  chain_summary: {
    total_call_oi: number
    total_put_oi: number
    pcr: number
  }
  key_strikes?: { strike: number; call_oi: number; put_oi: number }[]
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function OptionsAnalysis({ chain_summary, key_strikes }: OptionsAnalysisProps) {
  return (
    <Card className="my-2">
      <CardContent className="p-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Options Analysis
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Call OI</div>
            <div className="font-medium text-green-600 dark:text-green-400">
              {formatCompactNumber(chain_summary.total_call_oi)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Put OI</div>
            <div className="font-medium text-red-600 dark:text-red-400">
              {formatCompactNumber(chain_summary.total_put_oi)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">P/C Ratio</div>
            <div className="font-medium">{chain_summary.pcr.toFixed(2)}</div>
          </div>
        </div>

        {key_strikes && key_strikes.length > 0 && (
          <div className="border-t border-border pt-2">
            <div className="text-xs text-muted-foreground mb-1">Key Strikes</div>
            <div className="space-y-1">
              {key_strikes.map((s) => (
                <div key={s.strike} className="flex justify-between text-xs">
                  <span>${s.strike}</span>
                  <span className="text-green-600 dark:text-green-400">{formatCompactNumber(s.call_oi)}</span>
                  <span className="text-red-600 dark:text-red-400">{formatCompactNumber(s.put_oi)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
