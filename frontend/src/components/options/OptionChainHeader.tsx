import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useOptionChainStore } from '@/stores/optionChainStore'
import { Settings2 } from 'lucide-react'
import type { OptionChainColumnKey } from '@/types/layout'

interface OptionChainHeaderProps {
  expirations: string[]
  selectedExpiration: string | null
  onExpirationChange: (exp: string) => void
}

export function OptionChainHeader({ expirations, selectedExpiration, onExpirationChange }: OptionChainHeaderProps) {
  const { strikeCount, setStrikeCount, visibleColumns, toggleColumn, columnConfigs } = useOptionChainStore()

  const strikeCounts = [5, 10, 15, 20, 30]

  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        {expirations.length > 0 ? (
          <Tabs value={selectedExpiration || expirations[0]} onValueChange={onExpirationChange}>
            <TabsList className="h-7">
              {expirations.map((exp) => (
                <TabsTrigger key={exp} value={exp} className="text-xs px-2 py-1">
                  {formatExpiry(exp)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span className="text-xs text-muted-foreground">No expirations</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={strikeCount}
          onChange={(e) => setStrikeCount(Number(e.target.value))}
          className="h-7 rounded border border-border bg-background px-2 text-xs"
          aria-label="Strike count"
        >
          {strikeCounts.map((c) => (
            <option key={c} value={c}>±{c} strikes</option>
          ))}
        </select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="text-xs font-medium mb-2">Columns</div>
            {columnConfigs.map((col) => (
              <label key={col.key} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.key)}
                  onChange={() => toggleColumn(col.key as OptionChainColumnKey)}
                  className="rounded"
                />
                {col.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function formatExpiry(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()} '${String(d.getFullYear()).slice(2)}`
}
