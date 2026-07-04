// T016 — Session history store (capped at 100)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentSession } from '@/types/session-history'

interface SessionHistoryState {
  sessions: AgentSession[]
  maxSessions: number
  addSession: (session: AgentSession) => void
  removeSession: (id: string) => void
  getSession: (id: string) => AgentSession | undefined
}

export const useSessionHistoryStore = create<SessionHistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],
      maxSessions: 100,

      addSession: (session) =>
        set((s) => {
          const updated = [session, ...s.sessions]
          if (updated.length > s.maxSessions) updated.length = s.maxSessions
          return { sessions: updated }
        }),

      removeSession: (id) =>
        set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

      getSession: (id) => get().sessions.find((x) => x.id === id),
    }),
    { name: 'agentii-sessions' },
  ),
)
