import { useQuery } from '@tanstack/react-query'
import { fetchEIAInventory, fetchEIAPrices } from '@/api/eia'

export function EnergyMarketsTab() {
  const { data: inventoryData, isLoading: invLoading } = useQuery({
    queryKey: ['eia', 'inventory', 'Cushing', 'crude_oil'],
    queryFn: () => fetchEIAInventory({ region: 'Cushing', commodity: 'crude_oil' }),
    refetchInterval: 60 * 60 * 1000,
  })

  const { data: pricesData, isLoading: priceLoading } = useQuery({
    queryKey: ['eia', 'prices', 'wti'],
    queryFn: () => fetchEIAPrices({ commodity: 'wti' }),
    refetchInterval: 60 * 60 * 1000,
  })

  const inventory = inventoryData?.data || []
  const prices = pricesData?.data || []

  const latestInv = inventory[0]
  const latestPrice = prices[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full p-4 overflow-y-auto">
      {/* Cushing Crude Inventory */}
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">Cushing Crude Oil Inventory</h3>
        {invLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : latestInv ? (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                {(latestInv.value || latestInv.inventory_level_thousand_barrels || 0).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">thousand barrels</span>
            </div>
            {latestInv.weekly_change != null && (
              <div className={`text-sm font-medium ${latestInv.weekly_change < 0 ? 'text-red-500' : latestInv.weekly_change > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {latestInv.weekly_change > 0 ? '+' : ''}{latestInv.weekly_change.toLocaleString()} ({latestInv.weekly_change < 0 ? 'draw' : 'build'})
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Last updated: {latestInv.date ? new Date(latestInv.date).toLocaleDateString() : '—'}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No inventory data available</div>
        )}

        {/* Simple table of recent weeks */}
        {inventory.length > 1 && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="pb-1">Date</th>
                  <th className="pb-1 text-right">Level (k bbl)</th>
                  <th className="pb-1 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {inventory.slice(0, 12).map((row: any, i: number) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1">{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                    <td className="py-1 text-right">{(row.value || row.inventory_level_thousand_barrels || 0).toLocaleString()}</td>
                    <td className={`py-1 text-right ${(row.weekly_change || 0) < 0 ? 'text-red-500' : (row.weekly_change || 0) > 0 ? 'text-green-500' : ''}`}>
                      {row.weekly_change != null ? `${row.weekly_change > 0 ? '+' : ''}${row.weekly_change.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WTI Spot Price */}
      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-3">WTI Spot Price</h3>
        {priceLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : latestPrice ? (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">
                ${(latestPrice.price || latestPrice.price_usd || 0).toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">per barrel</span>
            </div>
            {latestPrice.daily_change != null && (
              <div className={`text-sm font-medium ${latestPrice.daily_change < 0 ? 'text-red-500' : latestPrice.daily_change > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {latestPrice.daily_change > 0 ? '+' : ''}${latestPrice.daily_change.toFixed(2)}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Last updated: {latestPrice.date ? new Date(latestPrice.date).toLocaleDateString() : '—'}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No price data available</div>
        )}

        {/* Recent prices table */}
        {prices.length > 1 && (
          <div className="mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="pb-1">Date</th>
                  <th className="pb-1 text-right">Price</th>
                  <th className="pb-1 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {prices.slice(0, 12).map((row: any, i: number) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1">{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                    <td className="py-1 text-right">${(row.price || row.price_usd || 0).toFixed(2)}</td>
                    <td className={`py-1 text-right ${(row.daily_change || 0) < 0 ? 'text-red-500' : (row.daily_change || 0) > 0 ? 'text-green-500' : ''}`}>
                      {row.daily_change != null ? `${row.daily_change > 0 ? '+' : ''}$${row.daily_change.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weekly summary */}
      <div className="border rounded-lg p-4 lg:col-span-2">
        <h3 className="text-sm font-medium mb-2">Weekly Petroleum Status Report</h3>
        <p className="text-sm text-muted-foreground">
          EIA publishes the Weekly Petroleum Status Report every Wednesday at ~10:30 AM ET.
          Data includes crude oil inventories by PADD district, refinery utilization, and spot prices.
        </p>
        {latestInv && (
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Latest report: </span>
            <span>{latestInv.date ? new Date(latestInv.date).toLocaleDateString() : '—'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
