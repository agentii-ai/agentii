import { lazy, Suspense, type ComponentProps } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const MapLibreMap = lazy(() => import('./MapLibreMap'))

function MapSkeleton() {
  return (
    <div className="relative w-full h-full min-h-[400px]">
      <Skeleton className="absolute inset-0 rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
        Loading map…
      </div>
    </div>
  )
}

export function MapLibreLazy(props: ComponentProps<typeof MapLibreMap>) {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <MapLibreMap {...props} />
    </Suspense>
  )
}
