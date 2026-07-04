# Agentii Frontend - Implementation Guide

## Quick Start

This guide provides step-by-step instructions for completing the remaining optimization work.

---

## Phase 1: Critical - Options Chain Virtualization (3 hours)

### Step 1: Install Dependency (5 minutes)

```bash
cd /Users/frank/A/agenzym/agentii/frontend
npm install @tanstack/react-virtual
```

### Step 2: Update package.json (verify)

The dependency should now appear in your package.json:

```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.0.0",
    // ... other dependencies
  }
}
```

### Step 3: Implement Virtualized Options Chain (2 hours)

**File**: `src/components/options/OptionChainGrid.tsx`

Replace the existing implementation with:

```tsx
import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useOptionChain } from '@/hooks/useOptionChain'
import { useOptionChainStore } from '@/stores/optionChainStore'
import { OptionChainHeader } from './OptionChainHeader'
import { OptionChainRow } from './OptionChainRow'
import { OptionDetail } from './OptionDetail'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OptionQuote } from '@/types/options'

interface OptionChainGridProps {
  symbol: string
  underlyingPrice?: number
}

export function OptionChainGrid({ symbol, underlyingPrice }: OptionChainGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [selectedContract, setSelectedContract] = useState<OptionQuote | null>(null)
  
  const { calls, puts, expirations, atmStrike, strikeRange, isLoading, isError } = 
    useOptionChain(symbol, underlyingPrice)
  const { visibleColumns, selectedExpiration, setSelectedExpiration } = useOptionChainStore()

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: strikeRange.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Row height in pixels
    overscan: 10, // Render 10 extra rows above/below viewport for smooth scrolling
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Loading options chain...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
        Failed to load options chain.
      </div>
    )
  }

  if (strikeRange.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <OptionChainHeader
          expirations={expirations}
          selectedExpiration={selectedExpiration}
          onExpirationChange={setSelectedExpiration}
        />
        <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
          No options available for {symbol}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <OptionChainHeader
        expirations={expirations}
        selectedExpiration={selectedExpiration}
        onExpirationChange={setSelectedExpiration}
      />

      {/* Column headers */}
      <div
        className="grid items-center border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
      >
        <div className="px-2 py-1.5 text-center text-green-600 dark:text-green-400">CALLS</div>
        <div className="px-3 py-1.5 text-center border-x border-border/50 min-w-[70px]">Strike</div>
        <div className="px-2 py-1.5 text-center text-red-600 dark:text-red-400">PUTS</div>
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const strike = strikeRange[virtualRow.index]
            const call = calls.find((c) => c.strike === strike)
            const put = puts.find((c) => c.strike === strike)

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <OptionChainRow
                  strike={strike}
                  call={call}
                  put={put}
                  isATM={strike === atmStrike}
                  visibleColumns={visibleColumns}
                  onSelect={setSelectedContract}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedContract && (
        <OptionDetail
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </div>
  )
}
```

### Step 4: Test Virtualization (30 minutes)

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Test with large chain**:
   - Navigate to `/options/SPY` (1000+ contracts)
   - Verify smooth scrolling at 60fps
   - Check that only visible rows are rendered (inspect DOM)

3. **Test edge cases**:
   - Empty chain (no contracts)
   - Single expiration
   - ATM highlighting works
   - Contract selection works

4. **Performance check**:
   - Open Chrome DevTools → Performance
   - Record scrolling through 1000+ rows
   - Verify no frame drops

---

## Phase 2: Update IVSurface Component (30 minutes)

### File: `src/components/options/IVSurface.tsx`

Update to use lazy-loaded Plotly:

```tsx
import { Suspense } from 'react'
import { Plot } from './PlotlyLazy'
import { useVolatilitySurface } from '@/api/options'
import { Skeleton } from '@/components/ui/skeleton'

interface IVSurfaceProps {
  symbol: string
}

export function IVSurface({ symbol }: IVSurfaceProps) {
  const { data: surface, isLoading } = useVolatilitySurface(symbol)

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />
  }

  if (!surface || surface.points.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-sm text-muted-foreground">
        No volatility surface data available
      </div>
    )
  }

  // Prepare data for Plotly 3D surface
  const strikes = [...new Set(surface.points.map(p => p.strike))].sort((a, b) => a - b)
  const expirations = [...new Set(surface.points.map(p => p.expiration))].sort()
  
  const z = expirations.map(exp =>
    strikes.map(strike => {
      const point = surface.points.find(p => p.strike === strike && p.expiration === exp)
      return point ? point.implied_volatility : null
    })
  )

  return (
    <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
      <Plot
        data={[
          {
            type: 'surface',
            x: strikes,
            y: expirations,
            z: z,
            colorscale: 'Viridis',
            hovertemplate: 'Strike: %{x}<br>Expiry: %{y}<br>IV: %{z:.2%}<extra></extra>',
          },
        ]}
        layout={{
          title: `${symbol} Implied Volatility Surface`,
          scene: {
            xaxis: { title: 'Strike Price' },
            yaxis: { title: 'Expiration' },
            zaxis: { title: 'Implied Volatility' },
          },
          autosize: true,
          height: 500,
        }}
        config={{ responsive: true }}
        className="w-full"
      />
    </Suspense>
  )
}
```

**Test**:
1. Navigate to Options page
2. Switch to "IV Surface" tab
3. Verify Plotly loads on demand (check Network tab)
4. Verify 3D surface renders correctly

---

## Phase 3: Wrap Charts with Error Boundaries (30 minutes)

### File: `src/pages/Dashboard.tsx`

Add error boundary:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { CandlestickChart } from '@/components/charts/CandlestickChart'
// ... other imports

export default function Dashboard() {
  const { selectedSymbol } = useWatchlistStore()
  const { data: bars } = useStockBars(selectedSymbol, '1d')

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <MarketStatusBadge />
      </div>

      <ErrorBoundary>
        <CandlestickChart
          bars={bars || []}
          symbol={selectedSymbol}
          enableCatalystMarkers
          enableRealtimeUpdates
        />
      </ErrorBoundary>

      {/* ... rest of page */}
    </div>
  )
}
```

### File: `src/pages/OptionsPage.tsx`

Add error boundary:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OptionChainGrid } from '@/components/options/OptionChainGrid'
// ... other imports

export default function OptionsPage() {
  const { symbol } = useParams()
  const { data: snapshot } = useStockSnapshot(symbol)

  return (
    <div className="flex flex-col h-full">
      <ErrorBoundary>
        <OptionChainGrid
          symbol={symbol || ''}
          underlyingPrice={snapshot?.quote?.last_price}
        />
      </ErrorBoundary>
    </div>
  )
}
```

**Test**:
1. Force an error (e.g., pass invalid data)
2. Verify error boundary catches it
3. Verify "Try again" button works
4. Verify error is logged to console

---

## Phase 4: Test Portfolio Greeks (30 minutes)

### File: `src/hooks/__tests__/usePortfolio.test.tsx` (NEW)

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePortfolioLive } from '../usePortfolio'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('usePortfolioLive', () => {
  it('computes net Greeks from option positions', async () => {
    const { result } = renderHook(() => usePortfolioLive(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const portfolio = result.current.data!
    
    // Verify net Greeks computation
    const expectedDelta = portfolio.option_positions.reduce(
      (sum, pos) => sum + pos.position_greeks.delta,
      0
    )
    
    expect(portfolio.net_greeks.delta).toBeCloseTo(expectedDelta, 2)
  })

  it('includes stock delta in net Greeks', async () => {
    const { result } = renderHook(() => usePortfolioLive(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const portfolio = result.current.data!
    
    // Stock delta = quantity / 100
    const stockDelta = portfolio.stock_positions.reduce(
      (sum, pos) => sum + pos.quantity / 100,
      0
    )
    
    const optionDelta = portfolio.option_positions.reduce(
      (sum, pos) => sum + pos.position_greeks.delta,
      0
    )
    
    expect(portfolio.net_greeks.delta).toBeCloseTo(stockDelta + optionDelta, 2)
  })

  it('handles empty portfolio', async () => {
    const { result } = renderHook(() => usePortfolioLive(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    const portfolio = result.current.data!
    
    if (portfolio.option_positions.length === 0 && portfolio.stock_positions.length === 0) {
      expect(portfolio.net_greeks.delta).toBe(0)
      expect(portfolio.net_greeks.gamma).toBe(0)
      expect(portfolio.net_greeks.theta).toBe(0)
      expect(portfolio.net_greeks.vega).toBe(0)
    }
  })
})
```

**Run tests**:
```bash
npm run test usePortfolio
```

---

## Phase 5: Verify Bundle Size (15 minutes)

```bash
# Build production bundle
npm run build

# Check bundle sizes
ls -lh dist/assets/*.js

# Expected output:
# - Main bundle: ~480KB gzipped
# - Plotly chunk: ~1MB gzipped (lazy loaded)
# - Lightweight Charts chunk: ~180KB gzipped
```

**Verify**:
1. Main bundle < 500KB ✅
2. Plotly in separate chunk ✅
3. Charts in separate chunk ✅

---

## Checklist

### Critical (This Week)
- [ ] Install @tanstack/react-virtual
- [ ] Implement virtualized options chain
- [ ] Test with 1000+ contracts (SPY)
- [ ] Update IVSurface to use PlotlyLazy
- [ ] Wrap charts with ErrorBoundary
- [ ] Test portfolio Greeks computation
- [ ] Verify bundle size < 500KB

### High Priority (Next Week)
- [ ] Install vitest-axe
- [ ] Create accessibility tests
- [ ] Implement WebSocket batching
- [ ] Add React.memo to components
- [ ] Create reconnection banner

### Medium Priority (Week 3)
- [ ] Add responsive layout
- [ ] Create loading skeletons
- [ ] Complete test coverage

---

## Troubleshooting

### Issue: Virtualization not working

**Symptoms**: All rows still rendering, no performance improvement

**Solution**:
1. Check that `parentRef` is attached to scrollable container
2. Verify `estimateSize` matches actual row height
3. Check browser console for errors

### Issue: Plotly not lazy loading

**Symptoms**: Plotly in main bundle, bundle size > 500KB

**Solution**:
1. Verify `PlotlyLazy.tsx` uses `React.lazy()`
2. Check that IVSurface wraps with `<Suspense>`
3. Clear build cache: `rm -rf dist && npm run build`

### Issue: Error boundary not catching errors

**Symptoms**: App still crashes on component errors

**Solution**:
1. Verify ErrorBoundary is a class component
2. Check that it wraps the component that might error
3. Test with forced error: `throw new Error('test')`

### Issue: Portfolio Greeks incorrect

**Symptoms**: Net Greeks don't match expected values

**Solution**:
1. Check that position_greeks are populated
2. Verify stock delta calculation (quantity / 100)
3. Add console.log to debug computation
4. Check for NaN or undefined values

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Initial Bundle | <500KB gzipped | `ls -lh dist/assets/*.js` |
| Options Chain Scroll | 60fps | Chrome DevTools Performance |
| WebSocket Updates | 60fps | Chrome DevTools Performance |
| Memory Leaks | None | Chrome DevTools Memory |
| Error Recovery | Graceful | Manual testing |

---

## Next Steps After Completion

Once all critical tasks are complete:

1. **Run full test suite**:
   ```bash
   npm run test
   npm run e2e
   ```

2. **Build and preview**:
   ```bash
   npm run build
   npm run preview
   ```

3. **Performance audit**:
   - Lighthouse score
   - Bundle analysis
   - Memory profiling

4. **Deploy to staging**:
   - Test with real data
   - Verify all features work
   - Get user feedback

5. **Plan next iteration**:
   - Accessibility tests
   - WebSocket batching
   - Responsive layout
   - Test coverage

---

## Support

If you encounter issues:

1. Check OPTIMIZATION_REPORT.md for detailed analysis
2. Review spec files in specs/002-agentii-frontend/
3. Check existing tests for patterns
4. Ask for clarification on specific implementations

Good luck! 🚀
