import { useMarketStatus } from '@/hooks/useMarketStatus'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const sessionConfig = {
  pre: { label: 'Pre-Market', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
  regular: { label: 'Market Open', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  post: { label: 'Post-Market', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' },
  closed: { label: 'Market Closed', className: 'bg-muted text-muted-foreground' },
} as const

export function MarketStatusBadge() {
  const session = useMarketStatus()
  const config = sessionConfig[session]

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}
