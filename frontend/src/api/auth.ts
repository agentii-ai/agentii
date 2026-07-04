import { apiClient } from './client'
import { useAuthStore } from '@/stores/authStore'

export async function login(username: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: { username: string } }>(
    '/auth/login',
    { username, password },
  )
  useAuthStore.getState().login(data.token, data.user)
  return data
}

export async function logout() {
  await apiClient.post('/auth/logout')
  useAuthStore.getState().logout()
}

export async function checkSession() {
  const { data } = await apiClient.get<{
    authenticated: boolean
    user: { username: string } | null
  }>('/auth/session')
  return data
}
