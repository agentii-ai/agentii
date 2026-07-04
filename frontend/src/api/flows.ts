import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { FlowWorkflow } from '@/types'

export function useFlows() {
  return useQuery({
    queryKey: ['flows'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ workflows: FlowWorkflow[] }>('/flows')
      return data.workflows
    },
    staleTime: 60_000,
  })
}

export function useFlow(id: string | undefined) {
  return useQuery({
    queryKey: ['flows', id],
    queryFn: async () => {
      const { data } = await apiClient.get<FlowWorkflow>(`/flows/${id}`)
      return data
    },
    enabled: !!id && id !== 'new',
    staleTime: 60_000,
  })
}

export function useCreateFlow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (flow: Omit<FlowWorkflow, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await apiClient.post<{ workflow: FlowWorkflow }>('/flows', flow)
      return data.workflow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })
}

export function useUpdateFlow(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (flow: Partial<FlowWorkflow>) => {
      const { data } = await apiClient.put<{ workflow: FlowWorkflow }>(`/flows/${id}`, flow)
      return data.workflow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      queryClient.invalidateQueries({ queryKey: ['flows', id] })
    },
  })
}

export function useDeleteFlow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/flows/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })
}

export function useRunFlow(id: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ run_id: string; status: string }>(`/flows/${id}/run`)
      return data
    },
  })
}
