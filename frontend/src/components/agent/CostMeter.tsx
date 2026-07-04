interface CostMeterProps {
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  budgetRemainingUsd?: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function CostMeter({ inputTokens, outputTokens, estimatedCost, budgetRemainingUsd }: CostMeterProps) {
  if (inputTokens === 0 && outputTokens === 0) return null

  return (
    <span className="text-[10px] text-muted-foreground">
      {formatTokens(inputTokens)} in / {formatTokens(outputTokens)} out · ${estimatedCost.toFixed(3)}
      {budgetRemainingUsd != null && (
        <span className="ml-1 text-muted-foreground/60">({formatTokens(budgetRemainingUsd)} left)</span>
      )}
    </span>
  )
}
