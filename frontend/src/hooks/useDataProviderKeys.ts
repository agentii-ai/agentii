// T020 — Data provider keys hook (extends useProviderKeys pattern)
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProviderStatus } from '@/types/data-provider'
import { DATA_PROVIDERS } from '@/data/data-providers'

export interface DataProviderKeyInfo {
  providerId: string
  status: ProviderStatus
  lastValidated?: string
}

const DATA_PROVIDER_IDS = DATA_PROVIDERS.map((p) => p.id)

export function useDataProviderKeys() {
  const [keys, setKeys] = useState<DataProviderKeyInfo[]>(
    DATA_PROVIDER_IDS.map((id) => ({ providerId: id, status: 'not-configured' })),
  )
  const [loading, setLoading] = useState(false)

  const listKeys = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('provider_keys')
        .select('provider_name, is_validated, validated_at')
        .in('provider_name', DATA_PROVIDER_IDS)
      if (!error && data) {
        setKeys(
          DATA_PROVIDER_IDS.map((id) => {
            const row = data.find((d: { provider_name: string }) => d.provider_name === id)
            if (!row) return { providerId: id, status: 'not-configured' as const }
            return {
              providerId: id,
              status: (row as { is_validated: boolean }).is_validated ? 'connected' as const : 'unvalidated' as const,
              lastValidated: (row as { validated_at: string | null }).validated_at ?? undefined,
            }
          }),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const saveKey = useCallback(
    async (providerId: string, credentials: Record<string, string>) => {
      const apiKey = Object.values(credentials).join(':')
      const { error } = await supabase.rpc('upsert_provider_key', {
        p_provider: providerId,
        p_api_key: apiKey,
      })
      if (error) throw error
      await listKeys()
    },
    [listKeys],
  )

  const validateAndSave = useCallback(
    async (providerId: string, credentials: Record<string, string>) => {
      const provider = DATA_PROVIDERS.find((p) => p.id === providerId)
      if (!provider) throw new Error(`Unknown provider: ${providerId}`)

      const result = await provider.validate(credentials)
      if (!result.valid) throw new Error(result.error ?? 'Validation failed')

      await saveKey(providerId, credentials)
      await supabase.rpc('mark_provider_key_validated', { p_provider: providerId })
      await listKeys()
    },
    [saveKey, listKeys],
  )

  const deleteKey = useCallback(
    async (providerId: string) => {
      const { error } = await supabase.from('provider_keys').delete().eq('provider_name', providerId)
      if (error) throw error
      await listKeys()
    },
    [listKeys],
  )

  useEffect(() => {
    listKeys()
  }, [listKeys])

  return { keys, loading, listKeys, saveKey, validateAndSave, deleteKey }
}
