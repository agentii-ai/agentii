// T039 — Agent Mode section
import { usePreferencesStore, type AgentModeKey } from '@/stores/preferencesStore'

const MODES: { key: AgentModeKey; label: string; description: string }[] = [
  { key: 'autonomous', label: 'Autonomous', description: 'Full tool access, no approval needed. The agent executes all actions independently.' },
  { key: 'manual', label: 'Manual', description: 'All tool calls require your approval before execution.' },
  { key: 'smart', label: 'Smart', description: 'Read-only tools auto-approved. Write and destructive actions require approval.' },
  { key: 'chat-only', label: 'Chat-only', description: 'Conversation only — no tool access. The agent can only respond with text.' },
]

export function AgentModeSection() {
  const { agentMode, setPreference } = usePreferencesStore()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Agent Mode</h2>
        <p className="text-xs text-muted-foreground mt-1">Control how autonomous the agent is during sessions.</p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Agent autonomy mode">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            role="radio"
            aria-checked={agentMode === mode.key}
            onClick={() => setPreference('agentMode', mode.key)}
            className={`w-full text-left p-3 rounded border transition-colors ${
              agentMode === mode.key
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full border-2 flex items-center justify-center ${
                agentMode === mode.key ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {agentMode === mode.key && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </div>
              <span className="text-xs font-medium">{mode.label}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 ml-5">{mode.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
