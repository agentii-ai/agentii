import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WindowDescriptor } from '@/types/ide'

interface WindowRegistryStore {
  windows: WindowDescriptor[]
  activeWindowId: string | null
  linkedPairs: { ideId: string; tradingId: string; ticker: string }[]

  registerWindow: (descriptor: WindowDescriptor) => void
  removeWindow: (windowId: string) => void
  setActiveWindow: (windowId: string) => void
  linkWindows: (ideId: string, tradingId: string, ticker: string) => void
  unlinkWindows: (ideId: string, tradingId: string) => void
}

export const useWindowRegistryStore = create<WindowRegistryStore>()(
  persist(
    (set, get) => ({
      windows: [],
      activeWindowId: null,
      linkedPairs: [],

      registerWindow: (descriptor) =>
        set({ windows: [...get().windows.filter((w) => w.windowId !== descriptor.windowId), descriptor] }),

      removeWindow: (windowId) =>
        set({
          windows: get().windows.filter((w) => w.windowId !== windowId),
          linkedPairs: get().linkedPairs.filter((p) => p.ideId !== windowId && p.tradingId !== windowId),
        }),

      setActiveWindow: (windowId) => set({ activeWindowId: windowId }),

      linkWindows: (ideId, tradingId, ticker) =>
        set({
          linkedPairs: [
            ...get().linkedPairs.filter((p) => p.ideId !== ideId && p.tradingId !== tradingId),
            { ideId, tradingId, ticker },
          ],
        }),

      unlinkWindows: (ideId, tradingId) =>
        set({ linkedPairs: get().linkedPairs.filter((p) => !(p.ideId === ideId && p.tradingId === tradingId)) }),
    }),
    { name: 'agentii-window-registry' },
  ),
)
