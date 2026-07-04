import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { formatOCCHuman } from '@/lib/occ'
import type { StockPosition, OptionPosition } from '@/types/portfolio'

interface PositionDetailProps {
  position: StockPosition | OptionPosition
  onClose: () => void
}

export function PositionDetail({ position, onClose }: PositionDetailProps) {
  const isOption = 'contract_symbol' in position

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">
            {isOption ? formatOCCHuman(position.contract_symbol) : position.symbol}
          </SheetTitle>
          <div className="flex items-center gap-2">
            {isOption && (
              <>
                <Badge variant={position.option_type === 'call' ? 'default' : 'destructive'}>
                  {position.option_type.toUpperCase()}
                </Badge>
                {position.is_expired && <Badge variant="outline">EXPIRED</Badge>}
              </>
            )}
            <Badge variant="outline">{position.provider}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <Section title="Position">
            <Row label="Symbol" value={isOption ? position.underlying_symbol : position.symbol} />
            {isOption && (
              <>
                <Row label="Strike" value={formatCurrency(position.strike)} />
                <Row label="Expiration" value={formatDate(position.expiration)} />
                <Row label="Days to Expiry" value={`${position.days_to_expiry}d`} />
              </>
            )}
            <Row label="Quantity" value={String(position.quantity)} />
            <Row label="Avg Entry" value={formatCurrency(position.avg_entry_price)} />
            <Row label="Current Price" value={formatCurrency(position.current_price)} />
          </Section>

          <Separator />

          <Section title="Value">
            <Row label="Market Value" value={formatCurrency(position.market_value)} />
            <Row label="Cost Basis" value={formatCurrency(position.cost_basis)} />
            <Row label="Unrealized P&L" value={formatCurrency(position.unrealized_pnl)} />
            <Row label="Unrealized P&L %" value={`${position.unrealized_pnl_pct.toFixed(2)}%`} />
          </Section>

          {isOption && position.position_greeks.is_complete && (
            <>
              <Separator />
              <Section title="Position Greeks">
                <Row label="Delta (Δ)" value={formatNumber(position.position_greeks.delta, 2)} />
                <Row label="Gamma (Γ)" value={formatNumber(position.position_greeks.gamma, 3)} />
                <Row label="Theta (Θ)" value={formatNumber(position.position_greeks.theta, 2)} />
                <Row label="Vega (ν)" value={formatNumber(position.position_greeks.vega, 2)} />
                <Row label="Rho (ρ)" value={formatNumber(position.position_greeks.rho, 3)} />
                <Row label="IV" value={`${(position.position_greeks.implied_volatility * 100).toFixed(1)}%`} />
              </Section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
