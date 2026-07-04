import { Card, CardContent } from '@/components/ui/card'
import { Calendar, TrendingUp, Filter, Brain, Shield, ShoppingCart, Bell } from 'lucide-react'

const nodeTypes = [
  { type: 'catalyst_source', label: 'Catalyst Source', icon: Calendar, category: 'Sources', description: 'FDA calendar events' },
  { type: 'price_alert', label: 'Price Alert', icon: TrendingUp, category: 'Sources', description: 'Price condition trigger' },
  { type: 'filter', label: 'Filter', icon: Filter, category: 'Filters', description: 'Filter by expression' },
  { type: 'agent_analysis', label: 'Agent Analysis', icon: Brain, category: 'Analysis', description: 'AI agent reasoning' },
  { type: 'risk_check', label: 'Risk Check', icon: Shield, category: 'Analysis', description: 'Position size limits' },
  { type: 'place_order', label: 'Place Order', icon: ShoppingCart, category: 'Actions', description: 'Execute trade' },
  { type: 'notification', label: 'Notification', icon: Bell, category: 'Actions', description: 'Send alert' },
]

const categories = ['Sources', 'Filters', 'Analysis', 'Actions']

export function FlowNodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-[240px] border-r border-border bg-card p-3 overflow-y-auto">
      <h3 className="text-sm font-semibold mb-3">Node Palette</h3>
      {categories.map((category) => (
        <div key={category} className="mb-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {category}
          </h4>
          <div className="space-y-2">
            {nodeTypes
              .filter((n) => n.category === category)
              .map((node) => {
                const Icon = node.icon
                return (
                  <Card
                    key={node.type}
                    className="cursor-grab active:cursor-grabbing hover:bg-accent transition-colors"
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type)}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{node.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {node.description}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
