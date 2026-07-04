import { useTrades } from '@/api/orders'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatOCCHuman } from '@/lib/occ'

export function TradeBook() {
  const { data: trades = [], isLoading } = useTrades()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Loading trades...
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead>Executed</TableHead>
            <TableHead>Order ID</TableHead>
            <TableHead>Agent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No trades
              </TableCell>
            </TableRow>
          ) : (
            trades.map((trade) => (
              <TableRow key={trade.trade_id}>
                <TableCell className="font-medium text-xs max-w-[180px] truncate">
                  {trade.asset_class === 'option' ? formatOCCHuman(trade.symbol) : trade.symbol}
                </TableCell>
                <TableCell>
                  <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                    {trade.side.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{trade.quantity}</TableCell>
                <TableCell className="text-right">{formatCurrency(trade.price)}</TableCell>
                <TableCell className="text-right">{formatCurrency(trade.commission)}</TableCell>
                <TableCell className="text-xs">{formatDate(trade.executed_at)}</TableCell>
                <TableCell className="text-xs font-mono">{trade.order_id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">{trade.agent_id ?? '—'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
