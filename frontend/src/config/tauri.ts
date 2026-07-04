export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

export function getPlatform(): 'macos' | 'windows' | 'linux' | 'web' {
  if (!isTauri()) return 'web'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  return 'linux'
}
