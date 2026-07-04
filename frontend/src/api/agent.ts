import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { AgentConversation } from '@/types'

export function useAgentConversation(id: string | null) {
  return useQuery({
    queryKey: ['agent', 'conversations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<AgentConversation>(`/agent/conversations/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}
