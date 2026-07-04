import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const mockCatalysts = [
  { date: '2026-04-15', title: 'Q1 2026 Earnings', type: 'earnings', impact: 'high' as const },
  { date: '2026-05-01', title: 'FDA PDUFA — Phase 3 Orforglipron', type: 'fda', impact: 'high' as const },
  { date: '2026-03-19', title: 'FOMC Rate Decision', type: 'macro', impact: 'medium' as const },
  { date: '2026-06-10', title: 'ASCO Annual Meeting', type: 'conference', impact: 'medium' as const },
  { date: '2026-04-01', title: 'CPI Report', type: 'macro', impact: 'low' as const },
]

const impactColors = {
  high: 'border-red-500/50 bg-red-500/5',
  medium: 'border-amber-500/50 bg-amber-500/5',
  low: 'border-border bg-muted/30',
}

export function CatalystsPanel() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Upcoming Catalysts</span>
      </div>
      <div className="space-y-2">
        {mockCatalysts.map((c) => (
          <div key={c.title} className={cn('rounded border p-2', impactColors[c.impact])}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{c.title}</span>
              <span className="text-[10px] text-muted-foreground">{c.date}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{c.type}</span>
              <span className={cn(
                'text-[10px]',
                c.impact === 'high' && 'text-red-400',
                c.impact === 'medium' && 'text-amber-400',
                c.impact === 'low' && 'text-muted-foreground',
              )}>
                {c.impact} impact
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
