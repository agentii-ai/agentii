import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import { formatOCCHuman } from '@/lib/occ'
import type { OptionPosition } from '@/types/portfolio'

interface GreeksBreakdownProps {
  optionPositions: OptionPosition[]
}

export function GreeksBreakdown({ optionPositions }: GreeksBreakdownProps) {
  if (optionPositions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Greeks Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No option positions</p>
        </CardContent>
      </Card>
    )
  }

  const totalDelta = optionPositions.reduce((sum, p) => sum + p.position_greeks.delta, 0)
  const totalGamma = optionPositions.reduce((sum, p) => sum + p.position_greeks.gamma, 0)
  const totalTheta = optionPositions.reduce((sum, p) => sum + p.position_greeks.theta, 0)
  const totalVega = optionPositions.reduce((sum, p) => sum + p.position_greeks.vega, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Greeks Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <GreekBar label="Delta (Δ)" positions={optionPositions} greek="delta" total={totalDelta} />
        <GreekBar label="Gamma (Γ)" positions={optionPositions} greek="gamma" total={totalGamma} />
        <GreekBar label="Theta (Θ)" positions={optionPositions} greek="theta" total={totalTheta} />
        <GreekBar label="Vega (ν)" positions={optionPositions} greek="vega" total={totalVega} />
      </CardContent>
    </Card>
  )
}

function GreekBar({ label, positions, greek, total }: { label: string; positions: OptionPosition[]; greek: keyof OptionPosition['position_greeks']; total: number }) {
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.position_greeks[greek] as number)))

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatNumber(total, 1)}</span>
      </div>
      <div className="space-y-1">
        {positions.map((pos) => {
          const value = pos.position_greeks[greek] as number
          const pct = maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0
          const isPositive = value >= 0

          return (
            <div key={pos.contract_symbol} className="flex items-center gap-2">
              <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden relative">
                <div
                  className={`h-full ${isPositive ? 'bg-green-500/50' : 'bg-red-500/50'}`}
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate">
                  {formatOCCHuman(pos.contract_symbol).split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
              <span className="text-xs w-12 text-right">{formatNumber(value, 1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
