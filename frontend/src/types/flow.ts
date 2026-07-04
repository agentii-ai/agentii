export interface FlowWorkflow {
  id: string
  name: string
  description: string | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  status: 'draft' | 'active' | 'paused'
  createdAt: string
  updatedAt: string
}

export interface FlowNode {
  id: string
  type: FlowNodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle: string | null
  targetHandle: string | null
}

export type FlowNodeType =
  | 'catalyst_source'
  | 'price_alert'
  | 'filter'
  | 'agent_analysis'
  | 'risk_check'
  | 'place_order'
  | 'notification'
