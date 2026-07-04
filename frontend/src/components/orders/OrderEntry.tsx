import { useState } from 'react'
import { usePlaceOrder } from '@/api/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import type { AssetClass, OrderSide, OrderType, TimeInForce } from '@/types/enums'

interface OrderEntryProps {
  defaultSymbol?: string
  defaultAssetClass?: AssetClass
  onSuccess?: () => void
}

export function OrderEntry({ defaultSymbol = '', defaultAssetClass = 'equity', onSuccess }: OrderEntryProps) {
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [assetClass] = useState<AssetClass>(defaultAssetClass)
  const [side, setSide] = useState<OrderSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('day')

  const placeMutation = usePlaceOrder()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!symbol || !quantity || Number(quantity) <= 0) {
      toast.error('Please fill in all required fields')
      return
    }

    if ((orderType === 'limit' || orderType === 'stop_limit') && (!price || Number(price) <= 0)) {
      toast.error('Price is required for limit orders')
      return
    }

    if ((orderType === 'stop' || orderType === 'stop_limit') && (!stopPrice || Number(stopPrice) <= 0)) {
      toast.error('Stop price is required for stop orders')
      return
    }

    try {
      await placeMutation.mutateAsync({
        symbol,
        asset_class: assetClass,
        exchange: assetClass === 'option' ? 'OPRA' : 'NASDAQ',
        side,
        order_type: orderType,
        time_in_force: timeInForce,
        quantity: Number(quantity),
        price: price ? Number(price) : undefined,
        stop_price: stopPrice ? Number(stopPrice) : undefined,
      })
      toast.success('Order placed successfully')
      onSuccess?.()
      // Reset form
      setQuantity('')
      setPrice('')
      setStopPrice('')
    } catch (error) {
      toast.error('Failed to place order')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Order Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="symbol" className="text-xs">Symbol</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="MRNA"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Side</Label>
            <ToggleGroup type="single" value={side} onValueChange={(v) => v && setSide(v as OrderSide)} className="justify-start">
              <ToggleGroupItem value="buy" className="text-xs">BUY</ToggleGroupItem>
              <ToggleGroupItem value="sell" className="text-xs">SELL</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div>
            <Label htmlFor="orderType" className="text-xs">Order Type</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
              <SelectTrigger id="orderType" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market" className="text-xs">Market</SelectItem>
                <SelectItem value="limit" className="text-xs">Limit</SelectItem>
                <SelectItem value="stop" className="text-xs">Stop</SelectItem>
                <SelectItem value="stop_limit" className="text-xs">Stop Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity" className="text-xs">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              className="h-8 text-sm"
            />
          </div>

          {(orderType === 'limit' || orderType === 'stop_limit') && (
            <div>
              <Label htmlFor="price" className="text-xs">Limit Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="42.50"
                className="h-8 text-sm"
              />
            </div>
          )}

          {(orderType === 'stop' || orderType === 'stop_limit') && (
            <div>
              <Label htmlFor="stopPrice" className="text-xs">Stop Price</Label>
              <Input
                id="stopPrice"
                type="number"
                step="0.01"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="40.00"
                className="h-8 text-sm"
              />
            </div>
          )}

          <div>
            <Label htmlFor="tif" className="text-xs">Time in Force</Label>
            <Select value={timeInForce} onValueChange={(v) => setTimeInForce(v as TimeInForce)}>
              <SelectTrigger id="tif" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day" className="text-xs">Day</SelectItem>
                <SelectItem value="gtc" className="text-xs">GTC</SelectItem>
                <SelectItem value="ioc" className="text-xs">IOC</SelectItem>
                <SelectItem value="fok" className="text-xs">FOK</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full h-8 text-xs" disabled={placeMutation.isPending}>
            {placeMutation.isPending ? 'Placing...' : 'Place Order'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
