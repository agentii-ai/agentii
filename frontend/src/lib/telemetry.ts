interface TimingMetric {
  name: string
  durationMs: number
  metadata?: Record<string, string | number>
}

const MAX_METRICS = 1000
const metrics: TimingMetric[] = []

export function recordTiming(name: string, durationMs: number, metadata?: Record<string, string | number>) {
  if (metrics.length >= MAX_METRICS) {
    metrics.splice(0, metrics.length - MAX_METRICS + 100) // drop oldest 100
  }
  metrics.push({ name, durationMs, metadata })
  if (import.meta.env.DEV) {
    console.debug(`[telemetry] ${name}: ${durationMs}ms`, metadata)
  }
}

export function startTimer(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}

export function getMetrics(): readonly TimingMetric[] {
  return metrics
}

export function clearMetrics(): void {
  metrics.length = 0
}
