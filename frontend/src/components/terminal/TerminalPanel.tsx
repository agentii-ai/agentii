import { useEffect, useCallback, useRef, useState } from 'react'
import { Minus, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import type { Terminal } from '@xterm/xterm'
import { useTerminalStore } from '@/stores/terminalStore'
import { useAgentOverlayStore } from '@/stores/agentOverlayStore'
import { useLayoutStore } from '@/stores/layoutStore'
import { useIDEStore } from '@/stores/ideStore'
import { TerminalInstance } from './TerminalInstance'
import { TerminalTabBar } from './TerminalTabBar'
import { GenerativeUIOverlay } from './GenerativeUIOverlay'
import { ApprovalGateOverlay } from './ApprovalGateOverlay'
import { CostMeterBadge } from './CostMeterBadge'
import { ToolCallProgress } from './ToolCallProgress'
import { ProjectSetupChat } from './ProjectSetupChat'
import { useOSCBridge } from '@/hooks/useOSCBridge'
import { useAgentChannel2 } from '@/hooks/useAgentChannel2'
import { usePreferencesStore } from '@/stores/preferencesStore'
import type { GenerativeUIPayload } from '@/types/terminal'
import { CLI_PROFILES } from '@/types/terminal'

export function TerminalPanel() {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const addTab = useTerminalStore((s) => s.addTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)
  const vmStatus = useTerminalStore((s) => s.vmStatus)
  const vmError = useTerminalStore((s) => s.vmError)
  const resetVmError = useTerminalStore((s) => s.resetVmError)
  const setVmStatus = useTerminalStore((s) => s.setVmStatus)
  const toggleTerminalPanel = useLayoutStore((s) => s.toggleTerminalPanel)
  const activeProjectId = useIDEStore((s) => s.activeProjectId)
  const loadPersistedLayout = useTerminalStore((s) => s.loadPersistedLayout)
  const defaultCliAgent = usePreferencesStore((s) => s.defaultCliAgent)

  // Determine if active tab is an agentii tab (for Channel 2)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const isAgentiiTab = activeTab?.type === 'agentii-cli'

  // Channel 2 structured API (agentii tabs only)
  const { resolveApproval } = useAgentChannel2({
    sessionId: activeTabId ?? '',
    enabled: isAgentiiTab && !!activeTabId,
  })

  // Channel 2 GenerativeUI payload (primary source for agentii tabs)
  const channel2Payload = useAgentOverlayStore((s) => s.generativeUIPayload)
  const dismissChannel2UI = useAgentOverlayStore((s) => s.dismissGenerativeUI)

  // Track Terminal instances per session for OSC bridge
  const terminalMapRef = useRef<Map<string, Terminal>>(new Map())
  const [activeTerminal, setActiveTerminal] = useState<Terminal | null>(null)

  // GenerativeUI overlay state (OSC 7777 fallback)
  const [oscPayload, setOscPayload] = useState<GenerativeUIPayload | null>(null)

  // OSC bridge on active terminal
  useOSCBridge({
    terminal: activeTerminal,
    onPayload: setOscPayload,
  })

  // Effective GenerativeUI payload: Channel 2 primary, OSC 7777 fallback
  const effectivePayload = (isAgentiiTab ? channel2Payload : null) ?? oscPayload

  // Update active terminal ref when active tab changes
  useEffect(() => {
    if (activeTabId) {
      const term = terminalMapRef.current.get(activeTabId) ?? null
      setActiveTerminal(term)
    } else {
      setActiveTerminal(null)
    }
  }, [activeTabId])

  // T026: Auto-create a default CLI tab when VM is running and no tabs exist
  useEffect(() => {
    if (vmStatus === 'running' && tabs.length === 0 && activeProjectId) {
      // Check for persisted layout first
      const persisted = loadPersistedLayout(activeProjectId)
      if (persisted && persisted.tabs.length > 0) {
        // Restore tabs from persisted layout
        const sorted = [...persisted.tabs].sort((a, b) => a.position - b.position)
        let activeRestoredId: string | null = null
        sorted.forEach((tab) => {
          const id = addTab(tab.cliId, tab.cliId as any)
          // C3: Restore the previously active tab
          if (tab.active) {
            activeRestoredId = id
          }
        })
        if (activeRestoredId) {
          setActiveTab(activeRestoredId)
        }
      } else {
        // No persisted layout — create default tab
        // U1: Validate defaultCliAgent is a known CLI, fall back to 'goose'
        const cli = defaultCliAgent && CLI_PROFILES.some((p) => p.command === defaultCliAgent || p.type === defaultCliAgent)
          ? defaultCliAgent
          : 'goose'
        addTab(cli, cli as any)
      }
    }
  }, [vmStatus, tabs.length, activeProjectId, addTab, setActiveTab, loadPersistedLayout, defaultCliAgent])

  // ⌘+J to toggle terminal panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        toggleTerminalPanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTerminalPanel])

  // Terminal tab navigation shortcuts: ⌘+Shift+] / ⌘+Shift+[ / ⌘+W
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey

      // ⌘+Shift+] → next tab
      if (meta && e.shiftKey && e.key === ']') {
        e.preventDefault()
        const state = useTerminalStore.getState()
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId)
        if (idx >= 0 && idx < state.tabs.length - 1) {
          state.setActiveTab(state.tabs[idx + 1].id)
        }
      }

      // ⌘+Shift+[ → prev tab
      if (meta && e.shiftKey && e.key === '[') {
        e.preventDefault()
        const state = useTerminalStore.getState()
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId)
        if (idx > 0) {
          state.setActiveTab(state.tabs[idx - 1].id)
        }
      }

      // ⌘+W → close active tab
      if (meta && e.key === 'w' && !e.shiftKey) {
        e.preventDefault()
        const state = useTerminalStore.getState()
        if (state.activeTabId) {
          state.removeTab(state.activeTabId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleTerminalReady = useCallback((tabId: string, terminal: Terminal) => {
    terminalMapRef.current.set(tabId, terminal)
    if (tabId === useTerminalStore.getState().activeTabId) {
      setActiveTerminal(terminal)
    }
  }, [])

  const handleDismissOverlay = useCallback(() => {
    setOscPayload(null)
    dismissChannel2UI()
  }, [dismissChannel2UI])

  // VM startup state
  if (vmStatus === 'starting') {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Terminal</span>
          <button
            type="button"
            onClick={toggleTerminalPanel}
            className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Minimize terminal panel"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Starting sandbox VM...</p>
        </div>
      </div>
    )
  }

  // VM error state
  if (vmStatus === 'error') {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Terminal</span>
          <button
            type="button"
            onClick={toggleTerminalPanel}
            className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Minimize terminal panel"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p className="text-sm text-red-400">{vmError ?? 'Failed to start sandbox VM'}</p>
          <button
            type="button"
            onClick={() => {
              resetVmError()
              setVmStatus('starting')
            }}
            className="flex items-center gap-1.5 rounded bg-muted px-3 py-1.5 text-xs hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Tab bar with CLI selector + status indicators + minimize button */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex-1 overflow-visible">
          <TerminalTabBar />
        </div>

        {/* Channel 2 status indicators (agentii tabs only) */}
        {isAgentiiTab && (
          <div className="flex items-center gap-2 px-2">
            <ToolCallProgress />
            <CostMeterBadge />
          </div>
        )}

        <button
          type="button"
          onClick={toggleTerminalPanel}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Minimize terminal panel"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Terminal instances — all rendered, only active visible */}
      <div className="relative flex-1 overflow-hidden">
        {!activeProjectId ? (
          <ProjectSetupChat />
        ) : tabs.length > 0 ? (
          tabs.map((tab) => (
            <TerminalInstance
              key={tab.id}
              terminalId={tab.id}
              projectId={activeProjectId}
              cli={tab.cli}
              isActive={tab.id === activeTabId}
              onTerminalReady={(terminal) => handleTerminalReady(tab.id, terminal)}
            />
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <p>No terminal sessions. Click [+] to create one.</p>
          </div>
        )}
      </div>

      {/* GenerativeUI floating overlay (Channel 2 primary, OSC 7777 fallback) */}
      <GenerativeUIOverlay payload={effectivePayload} onDismiss={handleDismissOverlay} />

      {/* ApprovalGate modal overlay (Channel 2, agentii tabs only) */}
      {isAgentiiTab && (
        <ApprovalGateOverlay resolveApproval={resolveApproval} />
      )}
    </div>
  )
}
