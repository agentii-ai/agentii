import { LayoutGrid, List } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'

export function ViewToggle() {
  const viewMode = useProjectStore((s) => s.viewMode)
  const setViewMode = useProjectStore((s) => s.setViewMode)

  return (
    <div className="inline-flex items-center rounded-md border bg-muted p-0.5" role="radiogroup" aria-label="View mode">
      <button
        type="button"
        role="radio"
        aria-checked={viewMode === 'grid'}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
          viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setViewMode('grid')}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={viewMode === 'table'}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
          viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setViewMode('table')}
        aria-label="Table view"
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
