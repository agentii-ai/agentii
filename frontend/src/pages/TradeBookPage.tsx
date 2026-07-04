import { TradeBook } from '@/components/orders/TradeBook'

export default function TradeBookPage() {
  return (
    <div className="flex flex-col h-full p-4">
      <h1 className="text-lg font-semibold mb-4">Trade Book</h1>
      <TradeBook />
    </div>
  )
}
