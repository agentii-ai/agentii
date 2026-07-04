// T018 — Tool usage store (aggregated by day, max 90 days)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ToolUsageDayBucket } from '@/types/session-history'

interface ToolUsageState {
  buckets: ToolUsageDayBucket[]
  maxDays: number
  recordToolCall: (toolName: string, success: boolean, durationMs: number) => void
  getTopTools: (limit?: number) => { toolName: string; callCount: number; successRate: number }[]
  getTimeline: () => { date: string; callCount: number }[]
}

export const useToolUsageStore = create<ToolUsageState>()(
  persist(
    (set, get) => ({
      buckets: [],
      maxDays: 90,

      recordToolCall: (toolName, success, durationMs) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10)
          const existing = s.buckets.find((b) => b.date === today && b.toolName === toolName)
          let updated: ToolUsageDayBucket[]
          if (existing) {
            updated = s.buckets.map((b) =>
              b.date === today && b.toolName === toolName
                ? {
                    ...b,
                    callCount: b.callCount + 1,
                    successCount: b.successCount + (success ? 1 : 0),
                    failureCount: b.failureCount + (success ? 0 : 1),
                    totalDurationMs: b.totalDurationMs + durationMs,
                  }
                : b,
            )
          } else {
            updated = [
              ...s.buckets,
              {
                date: today,
                toolName,
                callCount: 1,
                successCount: success ? 1 : 0,
                failureCount: success ? 0 : 1,
                totalDurationMs: durationMs,
              },
            ]
          }
          // Prune old buckets
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - s.maxDays)
          const cutoffStr = cutoff.toISOString().slice(0, 10)
          return { buckets: updated.filter((b) => b.date >= cutoffStr) }
        }),

      getTopTools: (limit = 10) => {
        const { buckets } = get()
        const agg: Record<string, { calls: number; success: number }> = {}
        for (const b of buckets) {
          if (!agg[b.toolName]) agg[b.toolName] = { calls: 0, success: 0 }
          agg[b.toolName].calls += b.callCount
          agg[b.toolName].success += b.successCount
        }
        return Object.entries(agg)
          .map(([toolName, { calls, success }]) => ({
            toolName,
            callCount: calls,
            successRate: calls > 0 ? success / calls : 0,
          }))
          .sort((a, b) => b.callCount - a.callCount)
          .slice(0, limit)
      },

      getTimeline: () => {
        const { buckets } = get()
        const byDate: Record<string, number> = {}
        for (const b of buckets) {
          byDate[b.date] = (byDate[b.date] ?? 0) + b.callCount
        }
        return Object.entries(byDate)
          .map(([date, callCount]) => ({ date, callCount }))
          .sort((a, b) => a.date.localeCompare(b.date))
      },
    }),
    { name: 'agentii-tool-usage' },
  ),
)
