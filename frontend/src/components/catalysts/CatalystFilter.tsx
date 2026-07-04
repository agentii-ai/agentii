import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import type { CatalystType } from '@/types/enums'

const catalystTypes: { value: CatalystType; label: string }[] = [
  { value: 'pdufa', label: 'PDUFA' },
  { value: 'adcom', label: 'AdCom' },
  { value: 'phase_3', label: 'Phase 3' },
  { value: 'phase_2', label: 'Phase 2' },
  { value: 'phase_1', label: 'Phase 1' },
  { value: 'nda_filing', label: 'NDA' },
  { value: 'bla_filing', label: 'BLA' },
  { value: 'data_readout', label: 'Data' },
  { value: 'conference', label: 'Conference' },
  { value: 'earnings', label: 'Earnings' },
]

const horizons = [
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: 'all', label: 'All' },
]

interface CatalystFilterProps {
  selectedTypes: CatalystType[]
  onTypesChange: (types: CatalystType[]) => void
  horizon: string
  onHorizonChange: (h: string) => void
  therapeuticArea: string
  onTherapeuticAreaChange: (area: string) => void
}

export function CatalystFilter({
  selectedTypes,
  onTypesChange,
  horizon,
  onHorizonChange,
  therapeuticArea,
  onTherapeuticAreaChange,
}: CatalystFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <ToggleGroup
        type="multiple"
        value={selectedTypes}
        onValueChange={(v) => onTypesChange(v as CatalystType[])}
        className="gap-1"
      >
        {catalystTypes.map((ct) => (
          <ToggleGroupItem key={ct.value} value={ct.value} size="sm" className="px-2 text-xs">
            {ct.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select value={horizon} onValueChange={onHorizonChange}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {horizons.map((h) => (
            <SelectItem key={h.value} value={h.value} className="text-xs">
              {h.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Therapeutic area..."
        value={therapeuticArea}
        onChange={(e) => onTherapeuticAreaChange(e.target.value)}
        className="h-8 w-[160px] text-xs"
      />
    </div>
  )
}
