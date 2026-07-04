import { FinancialTable } from './FinancialTable'
import { MiniChart } from './MiniChart'
import { CompanyCard } from './CompanyCard'
import { ComparisonGrid } from './ComparisonGrid'
import { SignalCard } from './SignalCardNew'
import { CatalystTimeline } from './CatalystTimeline'

type AnyComponent = React.ComponentType<Record<string, unknown>>

const registry: Record<string, AnyComponent> = {
  FinancialTable: FinancialTable as unknown as AnyComponent,
  MiniChart: MiniChart as unknown as AnyComponent,
  CompanyCard: CompanyCard as unknown as AnyComponent,
  ComparisonGrid: ComparisonGrid as unknown as AnyComponent,
  SignalCard: SignalCard as unknown as AnyComponent,
  CatalystTimeline: CatalystTimeline as unknown as AnyComponent,
}

interface GenerativeUIProps {
  component: string
  props: Record<string, unknown>
}

export function GenerativeUI({ component, props }: GenerativeUIProps) {
  const Component = registry[component]
  if (!Component) {
    return (
      <div className="rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
        Unknown component: {component}
      </div>
    )
  }
  return <Component {...props} />
}
