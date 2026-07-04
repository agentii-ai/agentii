import { Handle, Position } from '@xyflow/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell } from 'lucide-react'

interface NotificationNodeProps {
  data: {
    channel?: 'toast' | 'email' | 'desktop'
    message?: string
  }
  id: string
}

export function NotificationNode({ data, id }: NotificationNodeProps) {
  return (
    <Card className="min-w-[250px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={`${id}-channel`} className="text-xs">Channel</Label>
          <Select value={data.channel ?? 'toast'}>
            <SelectTrigger id={`${id}-channel`} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toast" className="text-xs">Toast</SelectItem>
              <SelectItem value="email" className="text-xs">Email</SelectItem>
              <SelectItem value="desktop" className="text-xs">Desktop</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-message`} className="text-xs">Message Template</Label>
          <Textarea
            id={`${id}-message`}
            value={data.message ?? ''}
            placeholder="PDUFA alert: {drug_name} on {event_date}"
            className="text-xs"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}
