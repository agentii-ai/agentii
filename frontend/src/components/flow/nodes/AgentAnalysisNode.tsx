import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brain } from 'lucide-react'

interface AgentAnalysisNodeProps {
  data: {
    agent_type?: 'research' | 'risk' | 'catalyst' | 'options'
    confidence_threshold?: number
  }
  id: string
}

export function AgentAnalysisNode({ data, id }: AgentAnalysisNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Agent Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`${id}-agent`} className="text-xs">Agent Type</Label>
          <Select value={data.agent_type ?? 'research'}>
            <SelectTrigger id={`${id}-agent`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="research" className="text-xs">Research Agent</SelectItem>
              <SelectItem value="risk" className="text-xs">Risk Agent</SelectItem>
              <SelectItem value="catalyst" className="text-xs">Catalyst Agent</SelectItem>
              <SelectItem value="options" className="text-xs">Options Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-confidence`} className="text-xs">Confidence Threshold (%)</Label>
          <Input
            id={`${id}-confidence`}
            type="number"
            value={data.confidence_threshold ?? 70}
            className="h-8 text-xs"
            min={0}
            max={100}
          />
        </div>
      </CardContent>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </Card>
  )
}
