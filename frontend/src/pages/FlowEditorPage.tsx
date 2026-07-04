import { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Play, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { FlowEditor } from '@/components/flow/FlowEditor'
import { useFlow, useCreateFlow, useUpdateFlow } from '@/api/flows'
import type { Node, Edge } from '@xyflow/react'

export default function FlowEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: workflow, isLoading } = useFlow(id)
  const createMutation = useCreateFlow()
  const updateMutation = useUpdateFlow(id ?? '')
  const [workflowName, setWorkflowName] = useState('')

  const handleSave = useCallback(
    async (nodes: Node[], edges: Edge[]) => {
      const name = workflowName || workflow?.name || 'New Workflow'

      try {
        if (id === 'new') {
          await createMutation.mutateAsync({
            name,
            description: '',
            nodes: nodes.map((n) => ({ id: n.id, type: n.type as any, position: n.position, data: n.data })),
            edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
            status: 'draft',
          })
          toast.success('Workflow created')
          navigate('/flow')
        } else if (id) {
          await updateMutation.mutateAsync({
            name,
            nodes: nodes.map((n) => ({ id: n.id, type: n.type as any, position: n.position, data: n.data })),
            edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
          })
          toast.success('Workflow saved')
        }
      } catch (error) {
        toast.error('Failed to save workflow')
      }
    },
    [id, workflowName, workflow, createMutation, updateMutation, navigate],
  )

  const handleRun = useCallback(() => {
    toast.success('Workflow started in paper mode')
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading workflow...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/flow')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={workflowName || workflow?.name || 'New Workflow'}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="h-8 w-[300px] text-sm font-semibold"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave([], [])}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button size="sm" onClick={handleRun}>
            <Play className="h-4 w-4 mr-1" /> Run
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <FlowEditor
          initialNodes={workflow?.nodes.map((n) => ({ ...n, type: n.type })) ?? []}
          initialEdges={workflow?.edges ?? []}
          onSave={handleSave}
          onRun={handleRun}
        />
      </div>
    </div>
  )
}
