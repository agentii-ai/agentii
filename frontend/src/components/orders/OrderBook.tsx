import { useState } from 'react'
import { useOrders } from '@/api/orders'
import { useCancelOrder } from '@/api/orders'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { formatOCCHuman } from '@/lib/occ'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { Order } from '@/types/orders'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  accepted: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  partially_filled: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  filled: 'bg-green-500/15 text-green-700 dark:text-green-400',
  cancelled: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400',
  expired: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
}

export function OrderBook() {
  const { data: orders = [], isLoading } = useOrders()
  const cancelMutation = useCancelOrder()
  const [activeTab, setActiveTab] = useState('open')

  const openOrders = orders.filter((o) => ['pending', 'accepted', 'partially_filled'].includes(o.status))
  const allOrders = orders

  const handleCancel = async (orderId: string) => {
    try {
      await cancelMutation.mutateAsync(orderId)
      toast.success('Order cancelled')
    } catch (error) {
      toast.error('Failed to cancel order')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Loading orders...
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="open">Open ({openOrders.length})</TabsTrigger>
        <TabsTrigger value="all">All ({allOrders.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="mt-3">
        <OrderTable orders={openOrders} onCancel={handleCancel} showCancel />
      </TabsContent>

      <TabsContent value="all" className="mt-3">
        <OrderTable orders={allOrders} onCancel={handleCancel} showCancel={false} />
      </TabsContent>
    </Tabs>
  )
}

function OrderTable({ orders, onCancel, showCancel }: { orders: Order[]; onCancel: (id: string) => void; showCancel: boolean }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Filled</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Avg Fill</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            {showCancel && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showCancel ? 10 : 9} className="text-center text-muted-foreground">
                No orders
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.order_id}>
                <TableCell className="font-medium text-xs max-w-[180px] truncate">
                  {order.asset_class === 'option' ? formatOCCHuman(order.symbol) : order.symbol}
                </TableCell>
                <TableCell>
                  <Badge variant={order.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                    {order.side.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{order.order_type}</TableCell>
                <TableCell className="text-right">{order.quantity}</TableCell>
                <TableCell className="text-right">{order.filled_quantity}</TableCell>
                <TableCell className="text-right">{order.price ? formatCurrency(order.price) : '—'}</TableCell>
                <TableCell className="text-right">{order.avg_fill_price ? formatCurrency(order.avg_fill_price) : '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('text-xs', statusColors[order.status] ?? '')}>
                    {order.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(order.created_at)}</TableCell>
                {showCancel && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onCancel(order.order_id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
