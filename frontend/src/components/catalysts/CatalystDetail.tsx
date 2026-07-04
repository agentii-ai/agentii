import { useCatalystDetail, useFDADecision } from '@/api/catalysts'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDate, formatCurrency, formatPercent, formatCompactNumber } from '@/lib/utils'
import type { CatalystEvent } from '@/types/biotech'

interface CatalystDetailProps {
  event: CatalystEvent
  onClose: () => void
}

export function CatalystDetail({ event, onClose }: CatalystDetailProps) {
  const { data: detail } = useCatalystDetail(event.id)
  const { data: decision } = useFDADecision(event.id)

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">{event.drug_name}</SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{event.symbol}</Badge>
            <Badge variant="outline" className="text-xs">
              {event.catalyst_type.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <Section title="Event">
            <Row label="Company" value={event.company_name} />
            <Row label="Indication" value={event.indication} />
            <Row label="Date" value={event.event_date ? `${formatDate(event.event_date)}${event.date_is_estimated ? ' (est.)' : ''}` : 'TBD'} />
            <Row label="Therapeutic Area" value={event.therapeutic_area ?? '—'} />
            {event.approval_probability != null && (
              <Row label="Approval Prob." value={`${Math.round(event.approval_probability * 100)}%`} />
            )}
            {event.expected_move_pct != null && (
              <Row label="Expected Move" value={`±${event.expected_move_pct}%`} />
            )}
            {event.description && (
              <p className="text-xs text-muted-foreground mt-2">{event.description}</p>
            )}
          </Section>

          {detail?.instrument && (
            <>
              <Separator />
              <Section title="Company">
                <Row label="Sector" value={detail.instrument.sector ?? '—'} />
                <Row label="Clinical Stage" value={detail.instrument.clinical_stage ?? '—'} />
                <Row label="FDA Pipeline" value={detail.instrument.has_fda_pipeline ? 'Yes' : 'No'} />
                <Row label="Market Cap" value={detail.instrument.market_cap ? formatCompactNumber(detail.instrument.market_cap) : '—'} />
              </Section>
            </>
          )}

          {detail?.snapshot?.quote && (
            <>
              <Separator />
              <Section title="Current Price">
                <Row label="Last" value={formatCurrency(detail.snapshot.quote.last_price)} />
                <Row label="Bid" value={formatCurrency(detail.snapshot.quote.bid)} />
                <Row label="Ask" value={formatCurrency(detail.snapshot.quote.ask)} />
                <Row label="Volume" value={formatCompactNumber(detail.snapshot.quote.volume)} />
              </Section>
            </>
          )}

          {detail?.chain_summary && (
            <>
              <Separator />
              <Section title="Options Summary">
                <Row label="Total Call OI" value={formatCompactNumber(detail.chain_summary.total_call_oi)} />
                <Row label="Total Put OI" value={formatCompactNumber(detail.chain_summary.total_put_oi)} />
                <Row label="Put/Call Ratio" value={detail.chain_summary.pcr.toFixed(2)} />
              </Section>
            </>
          )}

          {decision && (
            <>
              <Separator />
              <Section title="FDA Decision">
                <Row label="Outcome" value={decision.outcome.toUpperCase()} />
                <Row label="Decision Date" value={formatDate(decision.decision_date)} />
                <Row label="Price Before" value={formatCurrency(decision.price_before)} />
                <Row label="Price After" value={formatCurrency(decision.price_after)} />
                <Row label="Actual Move" value={decision.actual_move_pct != null ? formatPercent(decision.actual_move_pct) : '—'} />
                {decision.details && (
                  <p className="text-xs text-muted-foreground mt-2">{decision.details}</p>
                )}
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
