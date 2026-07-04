// T023-T025, T028, T031, T034, T037, T040 — Restructured SettingsPage with sidebar + detail
import { useTheme } from 'next-themes'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Moon, Sun, Monitor, Shield, Bell, Bot } from 'lucide-react'
import { usePreferencesStore, type LLMProvider } from '@/stores/preferencesStore'
import { useTauriDetect } from '@/hooks/useTauriDetect'
import { Badge } from '@/components/ui/badge'
import { ProviderKeysPanel } from '@/components/settings/ProviderKeysPanel'
import { SettingsSidebar, SETTINGS_SECTIONS } from '@/components/settings/SettingsSidebar'
import { SkillsSection } from '@/components/settings/SkillsSection'
import { MCPServersSection } from '@/components/settings/MCPServersSection'
import { DataProvidersSection } from '@/components/settings/DataProvidersSection'
import { AgentModeSection } from '@/components/settings/AgentModeSection'
import { ProjectInstructionsSection } from '@/components/settings/ProjectInstructionsSection'
import type { BarTimeframe } from '@/types/enums'

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = searchParams.get('section') ?? 'skills'
  const { theme, setTheme } = useTheme()
  const { isTauri, platform } = useTauriDetect()
  const prefs = usePreferencesStore()
  const { defaultTimeframe, notificationsEnabled, soundEnabled, optionChainStrikeCount, defaultProvider, defaultModel, setPreference } = prefs

  const handleSelectSection = (id: string) => {
    setSearchParams({ section: id })
  }

  const modelOptions: Record<LLMProvider, { value: string; label: string }[]> = {
    deepseek: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
    openai: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'o3-mini', label: 'o3-mini' },
    ],
    anthropic: [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
    gemini: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro' },
    ],
    groq: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    mistral: [
      { value: 'mistral-large-latest', label: 'Mistral Large' },
      { value: 'mistral-small-latest', label: 'Mistral Small' },
    ],
    openrouter: [
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    ],
    cerebras: [
      { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    ],
  }

  const providerOptions: { value: LLMProvider; label: string }[] = [
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'groq', label: 'Groq' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'cerebras', label: 'Cerebras' },
  ]

  const currentModels = modelOptions[defaultProvider] ?? []

  // Responsive: use dropdown below 768px
  const sidebarSection = SETTINGS_SECTIONS.find((s) => s.id === activeSection)

  const renderSection = () => {
    switch (activeSection) {
      case 'skills':
        return <SkillsSection />
      case 'mcp':
        return <MCPServersSection />
      case 'instructions':
        return <ProjectInstructionsSection />
      case 'agent-mode':
        return <AgentModeSection />
      case 'data-providers':
        return <DataProvidersSection />
      case 'llm-providers':
        return <ProviderKeysPanel />
      case 'appearance':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                  { value: 'system', icon: Monitor, label: 'System' },
                ].map(({ value, icon: Icon, label }) => (
                  <Button key={value} variant={theme === value ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setTheme(value)}>
                    <Icon className="h-3.5 w-3.5 mr-1" /> {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      case 'default-model':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" /> Default Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Provider</Label>
                <Select value={defaultProvider} onValueChange={(v) => {
                  const p = v as LLMProvider
                  setPreference('defaultProvider', p)
                  const first = modelOptions[p]?.[0]
                  if (first) setPreference('defaultModel', first.value)
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Model</Label>
                <Select value={defaultModel} onValueChange={(v) => setPreference('defaultModel', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currentModels.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )
      case 'trading':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Trading Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Default Timeframe</Label>
                <Select value={defaultTimeframe} onValueChange={(v) => setPreference('defaultTimeframe', v as BarTimeframe)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1m', '5m', '15m', '1h', '4h', '1d', '1w'].map((tf) => (
                      <SelectItem key={tf} value={tf} className="text-xs">{tf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Option Chain Strike Count</Label>
                <Input type="number" value={optionChainStrikeCount} onChange={(e) => setPreference('optionChainStrikeCount', Number(e.target.value))} className="h-8 text-xs w-24" min={1} max={50} />
              </div>
            </CardContent>
          </Card>
        )
      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Notifications</Label>
                <Switch checked={notificationsEnabled} onCheckedChange={(v) => setPreference('notificationsEnabled', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Sound Alerts</Label>
                <Switch checked={soundEnabled} onCheckedChange={(v) => setPreference('soundEnabled', v)} />
              </div>
            </CardContent>
          </Card>
        )
      case 'platform':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Platform
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Platform</Label>
                <Badge variant="outline" className="text-[10px]">{isTauri ? `Desktop (${platform})` : 'Web'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Credential Storage</Label>
                <Badge variant="outline" className="text-[10px]">{isTauri ? 'System Keychain' : 'Supabase Vault'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Trading Mode</Label>
                <Badge variant="secondary" className="text-[10px]">Paper Trading</Badge>
              </div>
            </CardContent>
          </Card>
        )
      default:
        return <p className="text-xs text-muted-foreground">Section not found.</p>
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — hidden on small screens, replaced by dropdown */}
      <div className="hidden md:block py-6 pl-6">
        <SettingsSidebar activeSection={activeSection} onSelect={handleSelectSection} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full p-6 overflow-auto">
        {/* Mobile section selector */}
        <div className="md:hidden mb-4">
          <Select value={activeSection} onValueChange={handleSelectSection}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue>{sidebarSection?.label ?? activeSection}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SETTINGS_SECTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-w-2xl">
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
