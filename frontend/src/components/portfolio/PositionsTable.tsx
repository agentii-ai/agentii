import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatPercent, formatNumber, cn } from '@/lib/utils'
import { formatOCCHuman } from '@/lib/occ'
import { Badge } from '@/components/ui/badge'
import type { StockPosition, OptionPosition } from '@/types/portfolio'

interface PositionsTableProps {
  stockPositions: StockPosition[]
  optionPositions: OptionPosition[]
  onSelectStock?: (position: StockPosition) => void
  onSelectOption?: (position: OptionPosition) => void
}

export function PositionsTable({ stockPositions, optionPositions, onSelectStock, onSelectOption }: PositionsTableProps) {
  const [activeTab, setActiveTab] = useState('stocks')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="stocks">Stocks ({stockPositions.length})</TabsTrigger>
        <TabsTrigger value="options">Options ({optionPositions.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="stocks" className="mt-3">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Entry</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Market Value</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockPositions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No stock positions
                  </TableCell>
                </TableRow>
              ) : (
                stockPositions.map((pos) => (
                  <TableRow
                    key={pos.symbol}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => onSelectStock?.(pos)}
                  >
                    <TableCell className="font-medium">{pos.symbol}</TableCell>
                    <TableCell className="text-right">{pos.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pos.avg_entry_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pos.current_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pos.market_value)}</TableCell>
                    <TableCell className={cn('text-right', pos.unrealized_pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {formatCurrency(pos.unrealized_pnl)}
                    </TableCell>
                    <TableCell className={cn('text-right', pos.unrealized_pnl_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {formatPercent(pos.unrealized_pnl_pct)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="options" className="mt-3">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Entry</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">DTE</TableHead>
                <TableHead className="text-right">Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optionPositions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No option positions
                  </TableCell>
                </TableRow>
              ) : (
                optionPositions.map((pos) => (
                  <TableRow
                    key={pos.contract_symbol}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => onSelectOption?.(pos)}
                  >
                    <TableCell className="font-medium text-xs max-w-[200px] truncate">
                      {formatOCCHuman(pos.contract_symbol)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pos.option_type === 'call' ? 'default' : 'destructive'} className="text-xs">
                        {pos.option_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{pos.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pos.avg_entry_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pos.current_price)}</TableCell>
                    <TableCell className={cn('text-right', pos.unrealized_pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {formatCurrency(pos.unrealized_pnl)}
                    </TableCell>
                    <TableCell className="text-right">{pos.days_to_expiry}d</TableCell>
                    <TableCell className="text-right">{formatNumber(pos.position_greeks.delta, 1)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  )
}
