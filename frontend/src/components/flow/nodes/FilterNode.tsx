import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Filter } from 'lucide-react'

interface FilterNodeProps {
  data: {
    expression?: string
  }
  id: string
}

export function FilterNode({ data, id }: FilterNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Label htmlFor={`${id}-expr`} className="text-xs">Filter Expression</Label>
          <Textarea
            id={`${id}-expr`}
            value={data.expression ?? ''}
            placeholder="approval_probability > 0.7"
            className="text-xs font-mono mt-1"
            rows={3}
          />
        </div>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </Card>
  )
}
