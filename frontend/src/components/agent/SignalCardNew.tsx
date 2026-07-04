import { cn } from '@/lib/utils'
import type { SignalCardProps } from '@/types/generative-ui'

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function SignalCard({ ticker, signal, confidence, reasoning, price, target }: SignalCardProps) {
  const colorMap = { buy: 'border-green-500 bg-green-500/5', sell: 'border-red-500 bg-red-500/5', hold: 'border-amber-500 bg-amber-500/5' }
  const textMap = { buy: 'text-green-500', sell: 'text-red-500', hold: 'text-amber-500' }

  return (
    <div className={cn('my-2 rounded border-l-2 p-3', colorMap[signal])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{ticker}</span>
          <span className={cn('text-xs font-bold uppercase', textMap[signal])}>{signal}</span>
        </div>
        {price != null && <span className="text-sm font-mono">${price.toFixed(2)}</span>}
      </div>
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', signal === 'buy' ? 'bg-green-500' : signal === 'sell' ? 'bg-red-500' : 'bg-amber-500')}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs font-mono">{confidence}%</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{reasoning}</p>
      {target != null && (
        <p className="mt-1 text-xs">Target: <span className="font-mono">${target.toFixed(2)}</span></p>
      )}
    </div>
  )
}
