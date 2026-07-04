// T044 — Agent Activity (Tool Usage Dashboard) page
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart3, CheckCircle2, Zap, ChevronLeft } from 'lucide-react'
import { useToolUsageStore } from '@/stores/toolUsageStore'

export default function AgentActivityPage() {
  const { buckets, getTopTools, getTimeline } = useToolUsageStore()
  const topTools = getTopTools(10)
  const timeline = getTimeline()
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  const { totalCalls, totalSuccess, uniqueTools, successRate } = useMemo(() => {
    const total = buckets.reduce((sum, b) => sum + b.callCount, 0)
    const success = buckets.reduce((sum, b) => sum + b.successCount, 0)
    const unique = new Set(buckets.map((b) => b.toolName)).size
    const rate = total > 0 ? Math.round((success / total) * 100) : 0
    return { totalCalls: total, totalSuccess: success, uniqueTools: unique, successRate: rate }
  }, [buckets])

  const toolDetail = useMemo(() => {
    if (!selectedTool) return null
    const toolBuckets = buckets.filter((b) => b.toolName === selectedTool)
    const calls = toolBuckets.reduce((s, b) => s + b.callCount, 0)
    const successes = toolBuckets.reduce((s, b) => s + b.successCount, 0)
    const failures = toolBuckets.reduce((s, b) => s + b.failureCount, 0)
    const totalDuration = toolBuckets.reduce((s, b) => s + b.totalDurationMs, 0)
    const avgLatency = calls > 0 ? Math.round(totalDuration / calls) : 0
    const recentDays = toolBuckets
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14)
    return { calls, successes, failures, avgLatency, recentDays }
  }, [selectedTool, buckets])

  if (totalCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-sm font-semibold mb-1">No tool usage data yet</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          Tool usage statistics will appear here after the agent uses tools during sessions. You'll see call counts, success rates, and trends.
        </p>
      </div>
    )
  }

  if (selectedTool && toolDetail) {
    return (
      <div className="flex flex-col h-full p-6 overflow-auto">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedTool(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold font-mono">{selectedTool}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 max-w-3xl">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-semibold">{toolDetail.calls}</p>
              <p className="text-[10px] text-muted-foreground">Total Calls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-semibold text-green-500">{toolDetail.successes}</p>
              <p className="text-[10px] text-muted-foreground">Successes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-semibold text-red-500">{toolDetail.failures}</p>
              <p className="text-[10px] text-muted-foreground">Failures</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-semibold">{toolDetail.avgLatency}ms</p>
              <p className="text-[10px] text-muted-foreground">Avg Latency</p>
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-sm">Recent Invocations (by day)</CardTitle>
          </CardHeader>
          <CardContent>
            {toolDetail.recentDays.length > 0 ? (
              <div className="space-y-1.5">
                {toolDetail.recentDays.map((day) => (
                  <div key={day.date} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="font-mono text-muted-foreground">{day.date}</span>
                    <div className="flex items-center gap-3">
                      <span>{day.callCount} calls</span>
                      <Badge variant={day.successCount === day.callCount ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0">
                        {day.callCount > 0 ? Math.round((day.successCount / day.callCount) * 100) : 0}% ok
                      </Badge>
                      <span className="text-muted-foreground">{day.callCount > 0 ? Math.round(day.totalDurationMs / day.callCount) : 0}ms avg</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No recent data.</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxCalls = topTools.length > 0 ? topTools[0].callCount : 1

  return (
    <div className="flex flex-col h-full p-6 overflow-auto">
      <h1 className="text-lg font-semibold mb-4">Agent Activity</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 max-w-3xl">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-lg font-semibold">{totalCalls}</p>
              <p className="text-[10px] text-muted-foreground">Total Tool Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-lg font-semibold">{successRate}%</p>
              <p className="text-[10px] text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-accent" />
            <div>
              <p className="text-lg font-semibold">{uniqueTools}</p>
              <p className="text-[10px] text-muted-foreground">Unique Tools</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topTools.map((tool) => (
              <button
                key={tool.toolName}
                className="w-full text-left space-y-1 p-1.5 -mx-1.5 rounded hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedTool(tool.toolName)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono">{tool.toolName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{tool.callCount} calls</span>
                    <Badge variant={tool.successRate >= 0.9 ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                      {Math.round(tool.successRate * 100)}%
                    </Badge>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(tool.callCount / maxCalls) * 100}%` }} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length > 0 ? (() => {
              const recentDays = timeline.slice(-30)
              const maxDay = Math.max(...recentDays.map((d) => d.callCount), 1)
              return (
              <div className="flex items-end gap-1 h-32">
                {recentDays.map((day) => {
                  const height = (day.callCount / maxDay) * 100
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center justify-end" title={`${day.date}: ${day.callCount} calls`}>
                      <div className="w-full bg-primary/60 rounded-t min-h-[2px]" style={{ height: `${height}%` }} />
                    </div>
                  )
                })}
              </div>
              )
            })() : (
              <p className="text-xs text-muted-foreground text-center py-8">No timeline data yet.</p>
            )}
            {timeline.length > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">{timeline[Math.max(0, timeline.length - 30)]?.date}</span>
                <span className="text-[9px] text-muted-foreground">{timeline[timeline.length - 1]?.date}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
