import { cn } from '@/lib/utils'
import { formatNumber, formatCompactNumber } from '@/lib/utils'
import type { OptionQuote } from '@/types/options'
import type { OptionChainColumnKey } from '@/types/layout'

interface OptionChainRowProps {
  strike: number
  call: OptionQuote | undefined
  put: OptionQuote | undefined
  isATM: boolean
  visibleColumns: OptionChainColumnKey[]
  onSelect?: (contract: OptionQuote) => void
}

export function OptionChainRow({ strike, call, put, isATM, visibleColumns, onSelect }: OptionChainRowProps) {
  return (
    <div
      className={cn(
        'grid items-center border-b border-border/50 text-xs hover:bg-accent/50 transition-colors',
        isATM && 'bg-accent/30 font-medium',
      )}
      style={{ gridTemplateColumns: `1fr auto 1fr` }}
    >
      {/* Call side */}
      <div
        className="grid gap-0 cursor-pointer hover:bg-accent/70 px-1 py-1.5"
        style={{ gridTemplateColumns: getCallGridCols(visibleColumns) }}
        onClick={() => call && onSelect?.(call)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && call) onSelect?.(call) }}
      >
        {visibleColumns.includes('oi') && <Cell value={formatCompactNumber(call?.open_interest)} align="right" />}
        {visibleColumns.includes('volume') && <Cell value={formatCompactNumber(call?.volume)} align="right" />}
        {visibleColumns.includes('iv') && <Cell value={call?.implied_volatility != null ? `${(call.implied_volatility * 100).toFixed(1)}%` : '—'} align="right" />}
        {visibleColumns.includes('delta') && <Cell value={formatNumber(call?.delta, 3)} align="right" />}
        {visibleColumns.includes('gamma') && <Cell value={formatNumber(call?.gamma, 4)} align="right" />}
        {visibleColumns.includes('theta') && <Cell value={formatNumber(call?.theta, 4)} align="right" />}
        {visibleColumns.includes('vega') && <Cell value={formatNumber(call?.vega, 4)} align="right" />}
        {visibleColumns.includes('bid') && <Cell value={formatNumber(call?.bid)} align="right" className="text-green-600 dark:text-green-400" />}
        {visibleColumns.includes('ltp') && <Cell value={formatNumber(call?.last_trade_price)} align="right" />}
        {visibleColumns.includes('ask') && <Cell value={formatNumber(call?.ask)} align="right" className="text-red-600 dark:text-red-400" />}
      </div>

      {/* Strike center */}
      <div className={cn('px-3 py-1.5 text-center font-semibold border-x border-border/50 min-w-[70px]', isATM && 'text-primary')}>
        {strike}
      </div>

      {/* Put side */}
      <div
        className="grid gap-0 cursor-pointer hover:bg-accent/70 px-1 py-1.5"
        style={{ gridTemplateColumns: getPutGridCols(visibleColumns) }}
        onClick={() => put && onSelect?.(put)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && put) onSelect?.(put) }}
      >
        {visibleColumns.includes('bid') && <Cell value={formatNumber(put?.bid)} align="left" className="text-green-600 dark:text-green-400" />}
        {visibleColumns.includes('ltp') && <Cell value={formatNumber(put?.last_trade_price)} align="left" />}
        {visibleColumns.includes('ask') && <Cell value={formatNumber(put?.ask)} align="left" className="text-red-600 dark:text-red-400" />}
        {visibleColumns.includes('delta') && <Cell value={formatNumber(put?.delta, 3)} align="left" />}
        {visibleColumns.includes('gamma') && <Cell value={formatNumber(put?.gamma, 4)} align="left" />}
        {visibleColumns.includes('theta') && <Cell value={formatNumber(put?.theta, 4)} align="left" />}
        {visibleColumns.includes('vega') && <Cell value={formatNumber(put?.vega, 4)} align="left" />}
        {visibleColumns.includes('iv') && <Cell value={put?.implied_volatility != null ? `${(put.implied_volatility * 100).toFixed(1)}%` : '—'} align="left" />}
        {visibleColumns.includes('volume') && <Cell value={formatCompactNumber(put?.volume)} align="left" />}
        {visibleColumns.includes('oi') && <Cell value={formatCompactNumber(put?.open_interest)} align="left" />}
      </div>
    </div>
  )
}

function Cell({ value, align, className }: { value: string; align: 'left' | 'right' | 'center'; className?: string }) {
  return (
    <span className={cn('px-1 tabular-nums', align === 'right' && 'text-right', align === 'left' && 'text-left', align === 'center' && 'text-center', className)}>
      {value}
    </span>
  )
}

function countVisiblePriceCols(cols: OptionChainColumnKey[]): number {
  const priceCols: OptionChainColumnKey[] = ['oi', 'volume', 'bid', 'ltp', 'ask', 'iv', 'delta', 'gamma', 'theta', 'vega']
  return priceCols.filter((c) => cols.includes(c)).length
}

function getCallGridCols(cols: OptionChainColumnKey[]): string {
  const n = countVisiblePriceCols(cols)
  return `repeat(${n}, minmax(45px, 1fr))`
}

function getPutGridCols(cols: OptionChainColumnKey[]): string {
  const n = countVisiblePriceCols(cols)
  return `repeat(${n}, minmax(45px, 1fr))`
}
