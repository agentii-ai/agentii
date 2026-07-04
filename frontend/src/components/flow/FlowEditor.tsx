import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FlowNodePalette } from './FlowNodePalette'
import { CatalystSourceNode } from './nodes/CatalystSourceNode'
import { PriceAlertNode } from './nodes/PriceAlertNode'
import { FilterNode } from './nodes/FilterNode'
import { AgentAnalysisNode } from './nodes/AgentAnalysisNode'
import { RiskCheckNode } from './nodes/RiskCheckNode'
import { PlaceOrderNode } from './nodes/PlaceOrderNode'
import { NotificationNode } from './nodes/NotificationNode'

interface FlowEditorProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onSave?: (nodes: Node[], edges: Edge[]) => void
  onRun?: () => void
}

const nodeTypes: NodeTypes = {
  catalyst_source: CatalystSourceNode,
  price_alert: PriceAlertNode,
  filter: FilterNode,
  agent_analysis: AgentAnalysisNode,
  risk_check: RiskCheckNode,
  place_order: PlaceOrderNode,
  notification: NotificationNode,
}

let nodeId = 0
const getNodeId = () => `node_${nodeId++}`

export function FlowEditor({ initialNodes = [], initialEdges = [], onSave, onRun }: FlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      // Edge validation: prevent invalid connections
      const sourceNode = nodes.find((n) => n.id === params.source)
      const targetNode = nodes.find((n) => n.id === params.target)

      // Don't allow connecting output nodes to input nodes
      if (sourceNode?.type === 'place_order' && targetNode?.type === 'catalyst_source') {
        return
      }
      if (sourceNode?.type === 'notification' && targetNode?.type === 'catalyst_source') {
        return
      }

      setEdges((eds) => addEdge(params, eds))
    },
    [nodes, setEdges],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (!type) return

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!reactFlowBounds) return

      const position = {
        x: event.clientX - reactFlowBounds.left - 125,
        y: event.clientY - reactFlowBounds.top - 50,
      }

      const newNode: Node = {
        id: getNodeId(),
        type,
        position,
        data: {},
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes],
  )

  const handleSave = useCallback(() => {
    onSave?.(nodes, edges)
  }, [nodes, edges, onSave])

  const handleRun = useCallback(() => {
    onRun?.()
  }, [onRun])

  return (
    <div className="flex h-full" ref={reactFlowWrapper}>
      <FlowNodePalette />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <button type="button" onClick={handleSave} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">Save</button>
          <button type="button" onClick={handleRun} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">Run</button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
        </div>
    </div>
  )
}
