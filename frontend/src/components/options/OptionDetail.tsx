import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatOCCHuman } from '@/lib/occ'
import { formatNumber, formatCurrency, formatCompactNumber, formatDate } from '@/lib/utils'
import type { OptionQuote } from '@/types/options'

interface OptionDetailProps {
  contract: OptionQuote
  onClose: () => void
}

export function OptionDetail({ contract, onClose }: OptionDetailProps) {
  const c = contract

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">
            {formatOCCHuman(c.contract_symbol)}
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={c.option_type === 'call' ? 'text-green-600' : 'text-red-600'}>
              {c.option_type === 'call' ? 'Call' : 'Put'}
            </Badge>
            {c.has_greeks && <Badge variant="secondary" className="text-xs">Greeks</Badge>}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <Section title="Identity">
            <Row label="Underlying" value={c.underlying_symbol} />
            <Row label="OCC Symbol" value={c.contract_symbol} mono />
            <Row label="Strike" value={formatCurrency(c.strike)} />
            <Row label="Expiration" value={formatDate(c.expiration)} />
            <Row label="DTE" value={c.dte != null ? `${c.dte}d` : '—'} />
            <Row label="Contract Size" value={String(c.contract_size)} />
          </Section>

          <Separator />

          <Section title="Pricing">
            <Row label="Bid" value={formatCurrency(c.bid)} className="text-green-600 dark:text-green-400" />
            <Row label="Ask" value={formatCurrency(c.ask)} className="text-red-600 dark:text-red-400" />
            <Row label="Mid" value={formatCurrency(c.mid_price)} />
            <Row label="Spread" value={formatCurrency(c.spread)} />
            <Row label="Mark" value={formatCurrency(c.mark)} />
            <Row label="Last" value={formatCurrency(c.last_trade_price)} />
          </Section>

          <Separator />

          <Section title="Change">
            <Row label="Prev Close" value={formatCurrency(c.prev_close)} />
            <Row label="Change" value={formatCurrency(c.change)} />
            <Row label="Change %" value={c.change_percent != null ? `${c.change_percent.toFixed(2)}%` : '—'} />
          </Section>

          <Separator />

          <Section title="Volume / OI">
            <Row label="Volume" value={formatCompactNumber(c.volume)} />
            <Row label="Open Interest" value={formatCompactNumber(c.open_interest)} />
          </Section>

          <Separator />

          <Section title="Greeks">
            <Row label="IV" value={c.implied_volatility != null ? `${(c.implied_volatility * 100).toFixed(2)}%` : '—'} />
            <Row label="Delta (Δ)" value={formatNumber(c.delta, 4)} />
            <Row label="Gamma (Γ)" value={formatNumber(c.gamma, 4)} />
            <Row label="Theta (Θ)" value={formatNumber(c.theta, 4)} />
            <Row label="Vega (ν)" value={formatNumber(c.vega, 4)} />
            <Row label="Rho (ρ)" value={formatNumber(c.rho, 4)} />
            <Row label="Theoretical" value={formatCurrency(c.theoretical_price)} />
          </Section>
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

function Row({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? 'font-mono text-xs' : ''} ${className ?? ''}`}>{value}</span>
    </div>
  )
}
