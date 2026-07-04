import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface SignalCardProps {
  symbol: string
  side: 'buy' | 'sell'
  confidence: number
  rationale: string
}

export function SignalCard({ symbol, side, confidence, rationale }: SignalCardProps) {
  return (
    <Card className="my-2">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{symbol}</span>
            <Badge variant={side === 'buy' ? 'default' : 'destructive'} className="text-xs">
              {side.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{confidence}%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{rationale}</p>
        <Button size="sm" variant="outline" className="text-xs h-7">
          Open Order Entry
        </Button>
      </CardContent>
    </Card>
  )
}
