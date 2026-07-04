import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isTauri } from '@/config/tauri'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  accessToken: string | null
  /** True when running in Tauri desktop without Supabase credentials configured */
  isDesktopOffline: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/** Desktop offline user — synthetic identity for local-only mode */
const DESKTOP_OFFLINE_USER: User = {
  id: 'local-desktop-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'local@desktop',
  app_metadata: {},
  user_metadata: { full_name: 'Local User' },
  created_at: new Date().toISOString(),
} as User

function hasSupabaseConfig(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const desktopOffline = isTauri() && !hasSupabaseConfig()

  useEffect(() => {
    // Desktop offline bypass — skip Supabase auth entirely
    if (desktopOffline) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [desktopOffline])

  const signIn = useCallback(async (email: string, password: string) => {
    if (desktopOffline) return { error: new Error('Sign-in unavailable in offline mode') }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }, [desktopOffline])

  const signUp = useCallback(async (email: string, password: string) => {
    if (desktopOffline) return { error: new Error('Sign-up unavailable in offline mode') }
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error ? new Error(error.message) : null }
  }, [desktopOffline])

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (desktopOffline) return
    await supabase.auth.signInWithOAuth({ provider })
  }, [desktopOffline])

  const signOut = useCallback(async () => {
    if (desktopOffline) return
    await supabase.auth.signOut()
  }, [desktopOffline])

  const value: AuthContextType = {
    session,
    user: desktopOffline ? DESKTOP_OFFLINE_USER : (session?.user ?? null),
    loading,
    accessToken: session?.access_token ?? null,
    isDesktopOffline: desktopOffline,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
