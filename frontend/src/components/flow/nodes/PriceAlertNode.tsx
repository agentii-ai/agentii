import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp } from 'lucide-react'

interface PriceAlertNodeProps {
  data: {
    symbol?: string
    condition?: 'above' | 'below' | 'crosses_above' | 'crosses_below'
    price?: number
  }
  id: string
}

export function PriceAlertNode({ data, id }: PriceAlertNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Price Alert
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
          <Label htmlFor={`${id}-condition`} className="text-xs">Condition</Label>
          <Select value={data.condition ?? 'above'}>
            <SelectTrigger id={`${id}-condition`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above" className="text-xs">Above</SelectItem>
              <SelectItem value="below" className="text-xs">Below</SelectItem>
              <SelectItem value="crosses_above" className="text-xs">Crosses Above</SelectItem>
              <SelectItem value="crosses_below" className="text-xs">Crosses Below</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-price`} className="text-xs">Price</Label>
          <Input
            id={`${id}-price`}
            type="number"
            step="0.01"
            value={data.price ?? ''}
            placeholder="42.50"
            className="h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </Card>
  )
}
