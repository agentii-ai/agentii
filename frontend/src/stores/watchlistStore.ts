import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Watchlist, WatchlistItem } from '@/types/watchlist'

interface WatchlistState {
  watchlists: Watchlist[]
  selectedSymbol: string | null
  addSymbol: (watchlistId: string, item: WatchlistItem) => void
  removeSymbol: (watchlistId: string, symbol: string) => void
  setSelected: (symbol: string | null) => void
  createWatchlist: (name: string) => string
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set) => ({
      watchlists: [
        {
          id: 'default',
          name: 'Watchlist',
          items: [
            { symbol: 'MRNA', exchange: 'NASDAQ', name: 'Moderna Inc', asset_class: 'equity', addedAt: new Date().toISOString() },
            { symbol: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc', asset_class: 'equity', addedAt: new Date().toISOString() },
            { symbol: 'SPY', exchange: 'ARCA', name: 'SPDR S&P 500 ETF', asset_class: 'etf', addedAt: new Date().toISOString() },
            { symbol: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA Corp', asset_class: 'equity', addedAt: new Date().toISOString() },
            { symbol: 'BNTX', exchange: 'NASDAQ', name: 'BioNTech SE', asset_class: 'equity', addedAt: new Date().toISOString() },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      selectedSymbol: 'MRNA',

      addSymbol: (watchlistId, item) => {
        set((state) => ({
          watchlists: state.watchlists.map((wl) =>
            wl.id === watchlistId && !wl.items.some((i) => i.symbol === item.symbol)
              ? { ...wl, items: [...wl.items, item], updatedAt: new Date().toISOString() }
              : wl,
          ),
        }))
      },

      removeSymbol: (watchlistId, symbol) => {
        set((state) => ({
          watchlists: state.watchlists.map((wl) =>
            wl.id === watchlistId
              ? { ...wl, items: wl.items.filter((i) => i.symbol !== symbol), updatedAt: new Date().toISOString() }
              : wl,
          ),
        }))
      },

      setSelected: (symbol) => set({ selectedSymbol: symbol }),

      createWatchlist: (name) => {
        const id = crypto.randomUUID()
        set((state) => ({
          watchlists: [
            ...state.watchlists,
            { id, name, items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          ],
        }))
        return id
      },
    }),
    { name: 'agentii-watchlist' },
  ),
)
