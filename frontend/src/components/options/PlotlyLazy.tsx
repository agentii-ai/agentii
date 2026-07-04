import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const Plot = lazy(() => import('react-plotly.js'))

interface PlotlyLazyProps {
  data: Plotly.Data[]
  layout: Partial<Plotly.Layout>
  config?: Partial<Plotly.Config>
  className?: string
  style?: React.CSSProperties
}

export function PlotlyLazy({ data, layout, config, className, style }: PlotlyLazyProps) {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full min-h-[300px]" />}>
      <Plot
        data={data}
        layout={layout}
        config={{ responsive: true, displayModeBar: false, ...config }}
        className={className}
        style={{ width: '100%', height: '100%', ...style }}
      />
    </Suspense>
  )
}
