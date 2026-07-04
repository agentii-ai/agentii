import { useState, useCallback, useEffect, useRef } from 'react'
import { useProviderKeys } from '@/hooks/useProviderKeys'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { GATEWAY_HTTP_URL } from '@/config/gateway'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ProjectReady {
  name: string
  tickers: string[]
  project_type: 'us_stock' | 'us_stock_option' | 'crypto' | 'predictive_market'
  description: string
}

export function useProjectSetupChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [projectReady, setProjectReady] = useState<ProjectReady | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { getKey, keys } = useProviderKeys()
  const defaultProvider = usePreferencesStore((s) => s.defaultProvider)
  const defaultModel = usePreferencesStore((s) => s.defaultModel)

  // Cache the resolved API key so we don't fetch from Vault on every send
  const apiKeyRef = useRef<string | null>(null)
  const providerRef = useRef(defaultProvider)

  // Re-fetch key when provider changes or keys list updates
  useEffect(() => {
    providerRef.current = defaultProvider
    apiKeyRef.current = null // invalidate cache
    getKey(defaultProvider).then((key) => {
      if (providerRef.current === defaultProvider) {
        apiKeyRef.current = key
      }
    })
  }, [defaultProvider, getKey, keys])

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)
    setError(null)

    // Resolve API key — use cached value or fetch fresh
    let apiKey = apiKeyRef.current
    if (!apiKey) {
      apiKey = await getKey(defaultProvider)
      apiKeyRef.current = apiKey
    }

    if (!apiKey) {
      setError(`No API key configured for ${defaultProvider}. Add one in Settings → LLM Providers.`)
      setIsLoading(false)
      return
    }

    try {
      const resp = await fetch(`${GATEWAY_HTTP_URL}/api/chat/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          provider: defaultProvider,
          model: defaultModel,
          api_key: apiKey,
        }),
      })

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        throw new Error(errBody.error || `Request failed: ${resp.status}`)
      }

      const data = await resp.json()
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.content }
      setMessages((prev) => [...prev, assistantMessage])

      if (data.project) {
        setProjectReady(data.project)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [messages, defaultProvider, defaultModel, getKey])

  const reset = useCallback(() => {
    setMessages([])
    setProjectReady(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return { messages, isLoading, projectReady, error, sendMessage, reset }
}
