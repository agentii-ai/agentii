import { create } from 'zustand'
import type { FlowNode, FlowEdge, FlowWorkflow } from '@/types/flow'

interface FlowState {
  activeWorkflowId: string | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  setActiveWorkflow: (id: string | null) => void
  setNodes: (nodes: FlowNode[]) => void
  setEdges: (edges: FlowEdge[]) => void
  addNode: (node: FlowNode) => void
  removeNode: (id: string) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  updateNodeData: (id: string, data: Record<string, unknown>) => void
  addEdge: (edge: FlowEdge) => void
  removeEdge: (id: string) => void
  serializeWorkflow: () => Pick<FlowWorkflow, 'nodes' | 'edges'>
  loadWorkflow: (workflow: FlowWorkflow) => void
  reset: () => void
}

export const useFlowStore = create<FlowState>((set, get) => ({
  activeWorkflowId: null,
  nodes: [],
  edges: [],

  setActiveWorkflow: (id) => set({ activeWorkflowId: id }),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  updateNodePosition: (id, position) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    })),

  updateNodeData: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),

  addEdge: (edge) => set((state) => ({ edges: [...state.edges, edge] })),

  removeEdge: (id) => set((state) => ({ edges: state.edges.filter((e) => e.id !== id) })),

  serializeWorkflow: () => {
    const { nodes, edges } = get()
    return { nodes, edges }
  },

  loadWorkflow: (workflow) =>
    set({
      activeWorkflowId: workflow.id,
      nodes: workflow.nodes,
      edges: workflow.edges,
    }),

  reset: () => set({ activeWorkflowId: null, nodes: [], edges: [] }),
}))
