import { useState, useRef, useEffect } from 'react'
import { X, Plus, ChevronDown, TerminalSquare, Bot, Code2, Zap, Shell, Bird } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTerminalStore, type TerminalTab } from '@/stores/terminalStore'
import { CLI_PROFILES, MAX_TERMINAL_TABS, type CliProfile } from '@/types/terminal'
import { CliStatusIndicator } from './CliStatusIndicator'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const cliIcons: Record<string, typeof TerminalSquare> = {
  bash: Shell,
  zsh: Shell,
  shell: Shell,
  goose: Bird,
  opencode: Code2,
  claude: Zap,
  codex: Code2,
  'agentii-cli': Bot,
  agentii: Bot,
  bot: Bot,
  bird: Bird,
  zap: Zap,
  code: Code2,
  terminal: TerminalSquare,
}

/** Resolve icon component from CliProfile.icon or CLI name */
function resolveIcon(profile: CliProfile): typeof TerminalSquare {
  return cliIcons[profile.icon] ?? cliIcons[profile.type] ?? TerminalSquare
}

export function TerminalTabBar() {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)
  const removeTab = useTerminalStore((s) => s.removeTab)
  const addTab = useTerminalStore((s) => s.addTab)
  const persistTabLayout = useTerminalStore((s) => s.persistTabLayout)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // T038: Fetch installed CLIs from gateway RPC, fall back to static list
  const { sendRpc } = useWebSocket()
  const projectId = useWorkspaceStore((s) => s.currentProjectId)
  const [availableProfiles] = useState<CliProfile[]>(CLI_PROFILES)
  const [installedIds, setInstalledIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    sendRpc<{ installed?: Array<{ id: string; display_name: string }> }>('cli.list_installed', { project_id: projectId })
      .then((result) => {
        if (cancelled || !result?.installed) return
        setInstalledIds(new Set(result.installed.map((c) => c.id)))
      })
      .catch(() => {
        // Gateway unavailable — keep all profiles enabled
      })
    return () => { cancelled = true }
  }, [projectId, sendRpc])

  const isMaxTabs = tabs.length >= MAX_TERMINAL_TABS

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  return (
    <div className="flex items-center border-b border-border bg-muted/30">
      <div className="flex flex-1 items-center gap-px overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const Icon = cliIcons[tab.cli] ?? cliIcons[tab.type] ?? TerminalSquare
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActiveTab(tab.id)
                }
              }}
              className={cn(
                'group relative flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 py-1.5 text-xs transition-colors hover:bg-accent',
                isActive && 'border-primary bg-background',
              )}
            >
              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="max-w-[120px] truncate">{tab.title}</span>
              {/* T054: CLI readiness indicator */}
              <CliStatusIndicator
                readiness={tab.readiness ?? 'connecting'}
                errorMessage={tab.readinessError}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(tab.id)
                }}
                className="ml-0.5 rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                aria-label={`Close ${tab.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>

      {/* CLI selector dropdown */}
      <div ref={dropdownRef} className="relative shrink-0 px-1">
        <button
          type="button"
          onClick={() => !isMaxTabs && setDropdownOpen(!dropdownOpen)}
          disabled={isMaxTabs}
          className={cn(
            'flex items-center gap-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground',
            isMaxTabs && 'cursor-not-allowed opacity-40',
          )}
          aria-label="New terminal"
          title={isMaxTabs ? `Maximum ${MAX_TERMINAL_TABS} tabs reached` : 'New terminal'}
        >
          <Plus className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-popover py-1 shadow-md">
            {availableProfiles.map((profile) => {
              const Icon = resolveIcon(profile)
              // C4: Gray out missing CLIs instead of hiding them
              const isInstalled = !installedIds || profile.type === 'shell' || installedIds.has(profile.command) || installedIds.has(profile.type)
              return (
                <button
                  key={profile.type}
                  type="button"
                  disabled={!isInstalled}
                  onClick={() => {
                    if (!isInstalled) return
                    addTab(profile.command, profile.type)
                    setDropdownOpen(false)
                    // T027: Persist layout after adding tab
                    setTimeout(() => persistTabLayout(), 0)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-xs',
                    isInstalled ? 'hover:bg-accent' : 'cursor-not-allowed opacity-40',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{profile.label}</span>
                  {!isInstalled && <span className="ml-1 text-[10px] text-muted-foreground">(not installed)</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">{profile.command}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
