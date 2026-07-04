import { useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface GraphExplorerProps {
  nodes: Array<{
    node_id: string
    node_type: string
    properties: Record<string, any>
  }>
  edges: Array<{
    edge_id: string
    source_node_id: string
    target_node_id: string
    edge_type: string
    timestamp?: string
    properties: Record<string, any>
  }>
  onNodeClick?: (nodeId: string) => void
  className?: string
}

const NODE_COLORS: Record<string, string> = {
  vessel: '#3b82f6',
  port: '#22c55e',
  commodity: '#f59e0b',
  country: '#8b5cf6',
}

const NODE_LABELS: Record<string, string> = {
  vessel: '🚢',
  port: '⚓',
  commodity: '🛢️',
  country: '🌍',
}

/** Deterministic hash for stable layout positions (no Math.random). */
function stableHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function GraphExplorer({ nodes, edges, onNodeClick, className = '' }: GraphExplorerProps) {
  const rfNodes = useMemo<Node[]>(() => {
    return nodes.map((n, i) => {
      const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
      const row = Math.floor(i / cols)
      const col = i % cols
      const jitter = stableHash(n.node_id) % 40

      return {
        id: n.node_id,
        position: { x: col * 200 + jitter, y: row * 120 + (jitter % 30) },
        data: {
          label: `${NODE_LABELS[n.node_type] || '●'} ${n.properties.name || n.node_id.split(':')[1] || n.node_id}`,
        },
        style: {
          background: NODE_COLORS[n.node_type] || '#6b7280',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 500,
        },
      }
    })
  }, [nodes])

  const rfEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const dwell = e.properties?.dwell_hours
      const label = dwell ? `${dwell.toFixed(0)}h` : e.edge_type

      return {
        id: e.edge_id,
        source: e.source_node_id,
        target: e.target_node_id,
        label,
        animated: e.edge_type === 'visited',
        style: { stroke: '#6b7280', strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: '#9ca3af' },
      }
    })
  }, [edges])

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(rfNodes)
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync internal state when props change (useNodesState only reads initial value)
  useEffect(() => {
    setFlowNodes(rfNodes)
  }, [rfNodes, setFlowNodes])

  useEffect(() => {
    setFlowEdges(rfEdges)
  }, [rfEdges, setFlowEdges])

  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick],
  )

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`}>
        No graph data. Select a vessel to see port visit relationships.
      </div>
    )
  }

  return (
    <div className={className}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => (n.style?.background as string) || '#6b7280'}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  )
}
