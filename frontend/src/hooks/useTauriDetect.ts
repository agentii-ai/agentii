import { isTauri, getPlatform } from '@/config/tauri'

export function useTauriDetect() {
  return {
    isTauri: isTauri(),
    platform: getPlatform(),
  }
}
