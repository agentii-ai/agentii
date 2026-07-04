import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { ProviderKeyInfo } from '@/types/project'

const PROVIDERS = ['anthropic', 'openai', 'deepseek', 'gemini', 'groq', 'mistral', 'openrouter', 'cerebras'] as const
export type ProviderName = (typeof PROVIDERS)[number]
export { PROVIDERS }

export function useProviderKeys() {
  const [keys, setKeys] = useState<ProviderKeyInfo[]>([])
  const [loading, setLoading] = useState(false)
  const { sendRpc } = useWebSocket()

  // T050: Notify gateway that keys changed so it re-provisions running VMs
  const notifyKeysChanged = useCallback(() => {
    sendRpc('settings.keys_changed', {}).catch(() => {
      // Gateway may not be running
    })
  }, [sendRpc])

  const listKeys = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('provider_keys')
        .select('provider_name, is_validated, validated_at')
      if (!error && data) setKeys(data as ProviderKeyInfo[])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveKey = useCallback(async (provider: string, apiKey: string) => {
    const { error } = await supabase.rpc('upsert_provider_key', {
      p_provider: provider,
      p_api_key: apiKey,
    })
    if (error) throw error
    await listKeys()
    notifyKeysChanged() // T050: Notify gateway
  }, [listKeys, notifyKeysChanged])

  const getKey = useCallback(async (provider: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('get_provider_key', {
      p_provider: provider,
    })
    if (error) return null
    return data as string | null
  }, [])

  const deleteKey = useCallback(async (provider: string) => {
    const { error } = await supabase
      .from('provider_keys')
      .delete()
      .eq('provider_name', provider)
    if (error) throw error
    await listKeys()
    notifyKeysChanged() // T050: Notify gateway
  }, [listKeys, notifyKeysChanged])

  const markValidated = useCallback(async (provider: string) => {
    await supabase.rpc('mark_provider_key_validated', { p_provider: provider })
    await listKeys()
  }, [listKeys])

  useEffect(() => {
    listKeys()
  }, [listKeys])

  return { keys, loading, listKeys, saveKey, getKey, deleteKey, markValidated, PROVIDERS }
}
