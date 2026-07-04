import { useEffect, useCallback } from 'react'
import { useSocket } from '@/hooks/useSocket'
import { isTauri } from '@/config/tauri'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import type { CatalystEvent } from '@/types/biotech'

export function useCatalystNotifications() {
  const { subscribe, unsubscribe } = useSocket()

  const handleCatalystAlert = useCallback(async (data: unknown) => {
    const event = data as CatalystEvent

    const title = `${event.catalyst_type.toUpperCase()} Alert`
    const body = `${event.drug_name} - ${event.indication} on ${event.event_date}`

    // If Tauri desktop, send OS notification
    if (isTauri()) {
      try {
        await invoke('send_notification', { title, body })
      } catch (error) {
        console.error('Failed to send desktop notification:', error)
        // Fallback to toast
        toast.info(body, { description: title })
      }
    } else {
      // Web: use toast notification
      toast.info(body, { description: title })
    }
  }, [])

  useEffect(() => {
    subscribe('catalyst_alert', handleCatalystAlert)
    return () => unsubscribe('catalyst_alert', handleCatalystAlert)
  }, [subscribe, unsubscribe, handleCatalystAlert])
}
