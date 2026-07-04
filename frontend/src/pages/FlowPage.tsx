import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Play, Pause, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useFlows, useDeleteFlow } from '@/api/flows'
import { toast } from 'sonner'

const statusColors = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400',
  paused: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  draft: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
}

export default function FlowPage() {
  const navigate = useNavigate()
  const { data: workflows = [], isLoading } = useFlows()
  const deleteMutation = useDeleteFlow()

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Workflow deleted')
    } catch (error) {
      toast.error('Failed to delete workflow')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading workflows...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Strategy Workflows</h1>
        <Button size="sm" onClick={() => navigate('/flow/new')}>
          <Plus className="h-4 w-4 mr-1" /> New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <p className="text-sm text-muted-foreground mb-4">No workflows yet</p>
          <Button onClick={() => navigate('/flow/new')}>
            <Plus className="h-4 w-4 mr-1" /> Create Your First Workflow
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/flow/${workflow.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{workflow.name}</h3>
                  <Badge variant="outline" className={statusColors[workflow.status]}>
                    {workflow.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{workflow.description}</p>
                <div className="flex items-center gap-2">
                  {workflow.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        toast.info('Pause workflow')
                      }}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  )}
                  {workflow.status === 'paused' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        toast.info('Resume workflow')
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleDelete(workflow.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
