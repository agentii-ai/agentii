import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { BarTimeframe } from '@/types/enums'

const timeframes: { value: BarTimeframe; label: string }[] = [
  { value: '1min', label: '1m' },
  { value: '5min', label: '5m' },
  { value: '15min', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1mo', label: '1M' },
]

interface TimeframeSelectorProps {
  value: BarTimeframe
  onChange: (tf: BarTimeframe) => void
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as BarTimeframe) }}
      className="gap-0"
    >
      {timeframes.map((tf) => (
        <ToggleGroupItem key={tf.value} value={tf.value} size="sm" className="px-2 text-xs">
          {tf.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
