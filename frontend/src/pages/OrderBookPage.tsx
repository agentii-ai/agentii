import { OrderBook } from '@/components/orders/OrderBook'

export default function OrderBookPage() {
  return (
    <div className="flex flex-col h-full p-4">
      <h1 className="text-lg font-semibold mb-4">Order Book</h1>
      <OrderBook />
    </div>
  )
}
