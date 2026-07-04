import { useState } from 'react'
import { Eye, EyeOff, Trash2, CheckCircle, XCircle, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useProviderKeys, PROVIDERS } from '@/hooks/useProviderKeys'
import { ProviderKeyDialog } from './ProviderKeyDialog'
import { usePreferencesStore } from '@/stores/preferencesStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const providerLabels: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  gemini: 'Google Gemini',
  groq: 'Groq',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
  cerebras: 'Cerebras',
}

export function ProviderKeysPanel() {
  const { keys, loading, deleteKey } = useProviderKeys()
  const [editProvider, setEditProvider] = useState<string | null>(null)
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState<string | null>(null)
  const defaultCliAgent = usePreferencesStore((s) => s.defaultCliAgent)
  const setPreference = usePreferencesStore((s) => s.setPreference)

  const configuredProviders = new Map(keys.map((k) => [k.provider_name, k]))

  const handleDelete = (provider: string) => {
    if (confirmDeleteProvider === provider) {
      deleteKey(provider)
      setConfirmDeleteProvider(null)
    } else {
      setConfirmDeleteProvider(provider)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">LLM Providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {PROVIDERS.map((provider) => {
          const info = configuredProviders.get(provider)
          return (
            <div
              key={provider}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{providerLabels[provider] ?? provider}</span>
                {info ? (
                  info.is_validated ? (
                    <Badge variant="secondary" className="gap-1 text-[10px] text-green-600">
                      <CheckCircle className="h-3 w-3" /> Validated
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-[10px] text-amber-600">
                      <XCircle className="h-3 w-3" /> Not validated
                    </Badge>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">Not configured</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditProvider(provider)}
                  aria-label={`Edit ${providerLabels[provider]} key`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {info && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${confirmDeleteProvider === provider ? 'text-destructive bg-destructive/10' : 'text-destructive'}`}
                    onClick={() => handleDelete(provider)}
                    aria-label={confirmDeleteProvider === provider ? `Confirm delete ${providerLabels[provider]} key` : `Delete ${providerLabels[provider]} key`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>

      <ProviderKeyDialog
        provider={editProvider}
        onClose={() => setEditProvider(null)}
      />

      {/* T029: Default CLI agent preference */}
      <CardHeader className="pt-2 pb-1">
        <CardTitle className="text-sm">Default CLI Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <select
          value={defaultCliAgent}
          onChange={(e) => setPreference('defaultCliAgent', e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          aria-label="Default CLI agent"
        >
          <option value="goose">Goose</option>
          <option value="claude">Claude Code</option>
          <option value="opencode">OpenCode</option>
          <option value="codex">Codex</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Auto-launched when opening a project
        </p>
      </CardContent>

      {/* T051: Per-project provider override — collapsed by default */}
      <ProjectProviderOverride />
    </Card>
  )
}

/** T051: Per-project provider override UI — advanced, collapsed by default */
function ProjectProviderOverride() {
  const [expanded, setExpanded] = useState(false)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const currentProjectId = useWorkspaceStore((s) => s.currentProjectId)

  if (!currentProjectId) return null

  const handleSave = async () => {
    // Write to workspace via the workspace API
    const body = JSON.stringify({
      project_id: currentProjectId,
      path: '/.agentii/config.toml',
      content: `[provider]\nname = "${provider}"\nmodel = "${model}"\n`,
    })
    try {
      await fetch('/api/workspace/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Silent fail — workspace API may not be running
    }
  }

  return (
    <>
      <CardHeader className="pt-2 pb-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Per-Project Override
          <Badge variant="outline" className="ml-1 text-[9px]">Advanced</Badge>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Override the LLM provider for this project only. Saved to <code>.agentii/config.toml</code>.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Use global default</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="google">Google</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Model (optional)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. claude-sonnet-4-20250514"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={!provider}>
            {saved ? 'Saved ✓' : 'Save Override'}
          </Button>
        </CardContent>
      )}
    </>
  )
}
