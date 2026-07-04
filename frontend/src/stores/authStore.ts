import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isTauri } from '@/config/tauri'

interface AuthState {
  user: { username: string } | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: { username: string }) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => boolean
  loadCredentials: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (token, user) => {
        set({ token, user, isAuthenticated: true })

        // If Tauri desktop, store credentials securely
        if (isTauri()) {
          try {
            await invoke('store_credentials', {
              apiKey: token,
              apiSecret: token, // In real app, separate key/secret
            })
          } catch (error) {
            console.error('Failed to store credentials in Tauri:', error)
          }
        }
      },

      logout: async () => {
        set({ token: null, user: null, isAuthenticated: false })

        // If Tauri desktop, delete secure credentials
        if (isTauri()) {
          try {
            await invoke('delete_credentials')
          } catch (error) {
            console.error('Failed to delete credentials in Tauri:', error)
          }
        }
      },

      checkSession: () => {
        return get().isAuthenticated && get().token !== null
      },

      loadCredentials: async () => {
        // If Tauri desktop, try to load credentials from secure storage
        if (isTauri()) {
          try {
            const hasCredentials = await invoke<boolean>('has_credentials')
            if (hasCredentials) {
              const creds = await invoke<{ api_key: string; api_secret: string }>('get_credentials')
              set({
                token: creds.api_key,
                user: { username: 'Desktop User' },
                isAuthenticated: true,
              })
            }
          } catch (error) {
            console.error('Failed to load credentials from Tauri:', error)
          }
        }
      },
    }),
    {
      name: 'agentii-auth',
      partialize: (state) => ({
        token: isTauri() ? null : state.token, // Don't persist token in localStorage if Tauri
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

// Auto-load credentials on app start if Tauri
if (isTauri()) {
  useAuthStore.getState().loadCredentials()
}
