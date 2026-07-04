import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// vi.mock factories are hoisted — use vi.hoisted for shared mocks
const mocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  },
}))

import { AuthProvider, useAuth } from '@/providers/AuthProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthProvider', () => {
  let authCallback: (event: string, session: unknown) => void

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.onAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
  })

  it('starts in loading state then resolves', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.session).toBeNull()
  })

  it('restores session from getSession', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'jwt-token-123',
    }
    mocks.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.session).toEqual(mockSession)
    expect(result.current.user?.id).toBe('user-1')
    expect(result.current.accessToken).toBe('jwt-token-123')
  })

  it('calls signInWithPassword', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signIn('test@example.com', 'password123')
    })

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('calls signUp', async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signUp('new@example.com', 'password123')
    })

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
    })
  })

  it('calls signOut', async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signOut()
    })

    expect(mocks.signOut).toHaveBeenCalled()
  })

  it('calls signInWithOAuth', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signInWithOAuth('github')
    })

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({ provider: 'github' })
  })

  it('updates session on auth state change', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    const newSession = {
      user: { id: 'user-2', email: 'new@example.com' },
      access_token: 'new-token',
    }

    act(() => {
      authCallback('SIGNED_IN', newSession)
    })

    expect(result.current.session).toEqual(newSession)
    expect(result.current.accessToken).toBe('new-token')
  })

  it('clears session on SIGNED_OUT event', async () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@example.com' },
      access_token: 'jwt-token',
    }
    mocks.getSession.mockResolvedValue({ data: { session: mockSession }, error: null })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.session).toEqual(mockSession))

    act(() => {
      authCallback('SIGNED_OUT', null)
    })

    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.accessToken).toBeNull()
  })
})
