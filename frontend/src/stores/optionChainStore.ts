import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OptionChainColumnKey } from '@/types/layout'

interface ColumnConfig {
  key: OptionChainColumnKey
  label: string
  side: 'call' | 'put' | 'center'
  width: number
  align: 'left' | 'center' | 'right'
  defaultVisible: boolean
}

const columnConfigs: ColumnConfig[] = [
  { key: 'oi', label: 'OI', side: 'call', width: 70, align: 'right', defaultVisible: true },
  { key: 'volume', label: 'Vol', side: 'call', width: 70, align: 'right', defaultVisible: true },
  { key: 'bid', label: 'Bid', side: 'call', width: 65, align: 'right', defaultVisible: true },
  { key: 'ltp', label: 'LTP', side: 'call', width: 65, align: 'right', defaultVisible: true },
  { key: 'ask', label: 'Ask', side: 'call', width: 65, align: 'right', defaultVisible: true },
  { key: 'iv', label: 'IV', side: 'call', width: 60, align: 'right', defaultVisible: true },
  { key: 'delta', label: 'Δ', side: 'call', width: 55, align: 'right', defaultVisible: true },
  { key: 'gamma', label: 'Γ', side: 'call', width: 55, align: 'right', defaultVisible: false },
  { key: 'theta', label: 'Θ', side: 'call', width: 55, align: 'right', defaultVisible: false },
  { key: 'vega', label: 'ν', side: 'call', width: 55, align: 'right', defaultVisible: false },
  { key: 'strike', label: 'Strike', side: 'center', width: 80, align: 'center', defaultVisible: true },
]

interface OptionChainState {
  visibleColumns: OptionChainColumnKey[]
  columnOrder: OptionChainColumnKey[]
  strikeCount: number
  selectedExpiration: string | null
  barStyle: 'gradient' | 'solid'
  columnConfigs: ColumnConfig[]
  toggleColumn: (key: OptionChainColumnKey) => void
  setStrikeCount: (count: number) => void
  setSelectedExpiration: (exp: string | null) => void
  setBarStyle: (style: 'gradient' | 'solid') => void
}

export const useOptionChainStore = create<OptionChainState>()(
  persist(
    (set) => ({
      visibleColumns: columnConfigs.filter((c) => c.defaultVisible).map((c) => c.key),
      columnOrder: columnConfigs.map((c) => c.key),
      strikeCount: 10,
      selectedExpiration: null,
      barStyle: 'gradient',
      columnConfigs,

      toggleColumn: (key) =>
        set((state) => ({
          visibleColumns: state.visibleColumns.includes(key)
            ? state.visibleColumns.filter((k) => k !== key)
            : [...state.visibleColumns, key],
        })),

      setStrikeCount: (count) => set({ strikeCount: count }),
      setSelectedExpiration: (exp) => set({ selectedExpiration: exp }),
      setBarStyle: (style) => set({ barStyle: style }),
    }),
    { name: 'agentii-option-chain' },
  ),
)
