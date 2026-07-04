// T017 — Scheduler store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScheduledTask } from '@/types/scheduler'

interface SchedulerState {
  tasks: ScheduledTask[]
  addTask: (task: ScheduledTask) => void
  updateTask: (id: string, updates: Partial<ScheduledTask>) => void
  removeTask: (id: string) => void
  toggleTask: (id: string, enabled: boolean) => void
}

export const useSchedulerStore = create<SchedulerState>()(
  persist(
    (set) => ({
      tasks: [],

      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),

      updateTask: (id, updates) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      toggleTask: (id, enabled) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, enabled } : t)),
        })),
    }),
    { name: 'agentii-scheduler' },
  ),
)
