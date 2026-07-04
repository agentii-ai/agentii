import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProviderKeys } from '@/hooks/useProviderKeys'

const VALIDATION_ENDPOINTS: Record<string, { url: string; headers: (key: string) => Record<string, string>; body?: string }> = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }),
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  },
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    headers: (key) => ({ 'x-goog-api-key': key }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
}

interface ProviderKeyDialogProps {
  provider: string | null
  onClose: () => void
}

export function ProviderKeyDialog({ provider, onClose }: ProviderKeyDialogProps) {
  const { saveKey, markValidated } = useProviderKeys()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setApiKey('')
    setError(null)
    setValidated(false)
    onClose()
  }

  const handleValidate = async () => {
    if (!provider || !apiKey.trim()) return
    setValidating(true)
    setError(null)
    setValidated(false)

    const endpoint = VALIDATION_ENDPOINTS[provider]
    if (!endpoint) {
      // No validation endpoint — just mark as valid
      setValidated(true)
      setValidating(false)
      return
    }

    try {
      const res = await fetch(endpoint.url, {
        method: endpoint.body ? 'POST' : 'GET',
        headers: endpoint.headers(apiKey.trim()),
        body: endpoint.body,
      })
      if (res.ok || res.status === 200 || res.status === 201) {
        setValidated(true)
      } else {
        const text = await res.text().catch(() => '')
        setError(`Validation failed (${res.status}): ${text.slice(0, 100)}`)
      }
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setValidating(false)
    }
  }

  const handleSave = async () => {
    if (!provider || !apiKey.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveKey(provider, apiKey.trim())
      if (validated) {
        await markValidated(provider)
      }
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!provider} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {provider}</DialogTitle>
          <DialogDescription>Enter your API key for {provider}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setValidated(false) }}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {validated && (
            <p className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> Key validated successfully
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleValidate}
            disabled={!apiKey.trim() || validating}
          >
            {validating ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Validating...</> : 'Validate'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
