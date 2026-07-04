import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BarTimeframe, OptionChainColumnKey } from '@/types'

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'cerebras'
export type AgentModeKey = 'autonomous' | 'manual' | 'smart' | 'chat-only'

interface PreferencesState {
  theme: 'light' | 'dark' | 'system'
  defaultTimeframe: BarTimeframe
  optionChainColumns: OptionChainColumnKey[]
  optionChainStrikeCount: number
  notificationsEnabled: boolean
  soundEnabled: boolean
  defaultProvider: LLMProvider
  defaultModel: string
  agentMode: AgentModeKey
  /** T028: Default CLI agent to auto-launch on project open */
  defaultCliAgent: string
  setPreference: <K extends keyof PreferencesState>(key: K, value: PreferencesState[K]) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      defaultTimeframe: '1d',
      optionChainColumns: ['oi', 'volume', 'bid', 'ltp', 'ask', 'iv', 'delta', 'gamma', 'theta', 'vega'],
      optionChainStrikeCount: 10,
      notificationsEnabled: true,
      soundEnabled: false,
      defaultProvider: 'deepseek',
      defaultModel: 'deepseek-chat',
      agentMode: 'autonomous',
      defaultCliAgent: 'goose',

      setPreference: (key, value) => set({ [key]: value }),
    }),
    { name: 'agentii-preferences' },
  ),
)
