// T005 — Scheduler types

export type ScheduleStatus = 'active' | 'paused' | 'pending-backend'

export interface TaskExecution {
  id: string
  startedAt: string
  endedAt: string
  durationMs: number
  status: 'success' | 'error'
  outputSummary: string
}

export interface ScheduledTask {
  id: string
  name: string
  prompt?: string
  skillId?: string
  cronExpression: string
  cronHumanReadable: string
  enabled: boolean
  status: ScheduleStatus
  nextRunAt?: string
  lastRunAt?: string
  lastRunStatus?: 'success' | 'error'
  executions: TaskExecution[]
  createdAt: string
}
