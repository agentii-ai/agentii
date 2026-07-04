import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShoppingCart } from 'lucide-react'
import type { OrderSide, OrderType } from '@/types/enums'

interface PlaceOrderNodeProps {
  data: {
    symbol?: string
    side?: OrderSide
    quantity?: number
    order_type?: OrderType
  }
  id: string
}

export function PlaceOrderNode({ data, id }: PlaceOrderNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg border-primary">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Place Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`${id}-symbol`} className="text-xs">Symbol</Label>
          <Input
            id={`${id}-symbol`}
            value={data.symbol ?? ''}
            placeholder="MRNA"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-side`} className="text-xs">Side</Label>
          <Select value={data.side ?? 'buy'}>
            <SelectTrigger id={`${id}-side`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy" className="text-xs">Buy</SelectItem>
              <SelectItem value="sell" className="text-xs">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-qty`} className="text-xs">Quantity</Label>
          <Input
            id={`${id}-qty`}
            type="number"
            value={data.quantity ?? 100}
            className="h-8 text-xs"
            min={1}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-type`} className="text-xs">Order Type</Label>
          <Select value={data.order_type ?? 'market'}>
            <SelectTrigger id={`${id}-type`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="market" className="text-xs">Market</SelectItem>
              <SelectItem value="limit" className="text-xs">Limit</SelectItem>
              <SelectItem value="stop" className="text-xs">Stop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
