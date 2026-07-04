import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield } from 'lucide-react'

interface RiskCheckNodeProps {
  data: {
    max_position_size?: number
    max_loss?: number
  }
  id: string
}

export function RiskCheckNode({ data, id }: RiskCheckNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg border-yellow-500">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Risk Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`${id}-size`} className="text-xs">Max Position Size ($)</Label>
          <Input
            id={`${id}-size`}
            type="number"
            value={data.max_position_size ?? 10000}
            className="h-8 text-xs"
            min={0}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-loss`} className="text-xs">Max Loss ($)</Label>
          <Input
            id={`${id}-loss`}
            type="number"
            value={data.max_loss ?? 1000}
            className="h-8 text-xs"
            min={0}
          />
        </div>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </Card>
  )
}
