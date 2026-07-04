import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'
import type { CatalystType } from '@/types/enums'

const catalystTypes: CatalystType[] = ['pdufa', 'adcom', 'phase_3', 'phase_2', 'phase_1', 'nda_filing', 'bla_filing', 'data_readout']

interface CatalystSourceNodeProps {
  data: {
    catalyst_type?: CatalystType
    days_ahead?: number
    therapeutic_area?: string
  }
  id: string
}

export function CatalystSourceNode({ data, id }: CatalystSourceNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Catalyst Source
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`${id}-type`} className="text-xs">Catalyst Type</Label>
          <Select value={data.catalyst_type} onValueChange={() => {}}>
            <SelectTrigger id={`${id}-type`} className="h-8 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Types</SelectItem>
              {catalystTypes.map((type) => (
                <SelectItem key={type} value={type} className="text-xs">
                  {type.replace('_', ' ').toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-days`} className="text-xs">Days Ahead</Label>
          <Input
            id={`${id}-days`}
            type="number"
            value={data.days_ahead ?? 30}
            className="h-8 text-xs"
            min={1}
            max={365}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-area`} className="text-xs">Therapeutic Area</Label>
          <Input
            id={`${id}-area`}
            value={data.therapeutic_area ?? ''}
            placeholder="e.g., Oncology"
            className="h-8 text-xs"
          />
        </div>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </Card>
  )
}
