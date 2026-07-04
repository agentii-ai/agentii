import { useAgentOverlayStore } from '@/stores/agentOverlayStore'
import { CostMeter } from '@/components/agent/CostMeter'

/**
 * Compact badge showing live session cost from Channel 2 COST_UPDATE events.
 * Positioned in the TerminalTabBar area. Only visible for agentii tabs.
 */
export function CostMeterBadge() {
  const costData = useAgentOverlayStore((s) => s.costData)

  if (!costData) return null

  return (
    <div
      className="flex items-center rounded-full bg-muted/60 px-2 py-0.5"
      title={`Input: ${costData.inputTokens} tokens, Output: ${costData.outputTokens} tokens, Cost: $${costData.estimatedCostUsd.toFixed(4)}${costData.budgetRemainingUsd != null ? `, Budget remaining: $${costData.budgetRemainingUsd.toFixed(2)}` : ''}`}
    >
      <CostMeter
        inputTokens={costData.inputTokens}
        outputTokens={costData.outputTokens}
        estimatedCost={costData.estimatedCostUsd}
        budgetRemainingUsd={costData.budgetRemainingUsd}
      />
    </div>
  )
}
