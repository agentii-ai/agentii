import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { useTerminalStore } from '@/stores/terminalStore'
import { useAgentOverlayStore } from '@/stores/agentOverlayStore'
import { useLayoutStore, widthToBreakpoint } from '@/stores/layoutStore'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x">×</span>,
  Plus: () => <span data-testid="icon-plus">+</span>,
  ChevronDown: () => <span data-testid="icon-chevron">▾</span>,
  TerminalSquare: () => <span data-testid="icon-terminal">T</span>,
  Bot: () => <span data-testid="icon-bot">B</span>,
  Code2: () => <span data-testid="icon-code">C</span>,
  Zap: () => <span data-testid="icon-zap">Z</span>,
  Shell: () => <span data-testid="icon-shell">S</span>,
  Bird: () => <span data-testid="icon-bird">G</span>,
  Minus: () => <span data-testid="icon-minus">-</span>,
  Loader2: () => <span data-testid="icon-loader">L</span>,
  AlertCircle: () => <span data-testid="icon-alert">!</span>,
  RefreshCw: () => <span data-testid="icon-refresh">R</span>,
  ShieldAlert: () => <span data-testid="icon-shield">S</span>,
}))

describe('terminalStore', () => {
  beforeEach(() => {
    useTerminalStore.getState().reset()
  })

  it('creates default tab with addTab', () => {
    const { result } = renderHook(() => useTerminalStore())

    act(() => {
      result.current.addTab('bash')
    })

    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.tabs[0].cli).toBe('bash')
    expect(result.current.tabs[0].type).toBe('shell')
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id)
  })

  it('creates agentii tab with correct type', () => {
    const { result } = renderHook(() => useTerminalStore())

    act(() => {
      result.current.addTab('agentii', 'agentii-cli')
    })

    expect(result.current.tabs[0].type).toBe('agentii-cli')
    expect(result.current.tabs[0].cli).toBe('agentii')
  })

  it('enforces max 8 tabs', () => {
    const { result } = renderHook(() => useTerminalStore())

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addTab('bash')
      }
    })

    expect(result.current.tabs).toHaveLength(8)
  })

  it('removes tab and switches to adjacent', () => {
    const { result } = renderHook(() => useTerminalStore())

    let id1 = ''
    let id2 = ''
    act(() => {
      id1 = result.current.addTab('bash')
      id2 = result.current.addTab('goose', 'goose')
    })

    expect(result.current.activeTabId).toBe(id2)

    act(() => {
      result.current.removeTab(id2)
    })

    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe(id1)
  })

  it('switches active tab', () => {
    const { result } = renderHook(() => useTerminalStore())

    let id1 = ''
    act(() => {
      id1 = result.current.addTab('bash')
      result.current.addTab('goose', 'goose')
    })

    act(() => {
      result.current.setActiveTab(id1)
    })

    expect(result.current.activeTabId).toBe(id1)
  })

  it('sets VM status', () => {
    const { result } = renderHook(() => useTerminalStore())

    act(() => {
      result.current.setVmStatus('starting')
    })
    expect(result.current.vmStatus).toBe('starting')

    act(() => {
      result.current.setVmStatus('error', 'VM boot failed')
    })
    expect(result.current.vmStatus).toBe('error')
    expect(result.current.vmError).toBe('VM boot failed')
  })
})

describe('agentOverlayStore', () => {
  beforeEach(() => {
    useAgentOverlayStore.getState().resetAll()
  })

  it('pushes and resolves approval', () => {
    const { result } = renderHook(() => useAgentOverlayStore())

    act(() => {
      result.current.pushApproval({
        requestId: 'req-1',
        command: 'rm -rf /tmp/test',
        description: 'Delete temp files',
        expiresAt: Date.now() + 120_000,
      })
    })

    expect(result.current.approvalQueue).toHaveLength(1)
    expect(result.current.approvalQueue[0].requestId).toBe('req-1')

    act(() => {
      result.current.resolveApproval('req-1')
    })

    expect(result.current.approvalQueue).toHaveLength(0)
  })

  it('updates cost data', () => {
    const { result } = renderHook(() => useAgentOverlayStore())

    act(() => {
      result.current.updateCost({
        inputTokens: 1200,
        outputTokens: 3400,
        estimatedCostUsd: 0.052,
      })
    })

    expect(result.current.costData).not.toBeNull()
    expect(result.current.costData?.inputTokens).toBe(1200)
    expect(result.current.costData?.estimatedCostUsd).toBe(0.052)
  })

  it('sets and clears tool call', () => {
    const { result } = renderHook(() => useAgentOverlayStore())

    act(() => {
      result.current.setToolCall({
        toolCallId: 'tc-1',
        toolName: 'fetch_document',
        input: { source: 'LLY-10Q' },
      })
    })

    expect(result.current.activeToolCall?.toolName).toBe('fetch_document')

    act(() => {
      result.current.clearToolCall('tc-1')
    })

    expect(result.current.activeToolCall).toBeNull()
  })

  it('sets and dismisses generativeUI', () => {
    const { result } = renderHook(() => useAgentOverlayStore())

    act(() => {
      result.current.setGenerativeUI({
        component: 'FinancialTable',
        props: { columns: [], rows: [] },
      })
    })

    expect(result.current.generativeUIPayload?.component).toBe('FinancialTable')

    act(() => {
      result.current.dismissGenerativeUI()
    })

    expect(result.current.generativeUIPayload).toBeNull()
  })

  it('resetAll clears everything', () => {
    const { result } = renderHook(() => useAgentOverlayStore())

    act(() => {
      result.current.pushApproval({
        requestId: 'req-1',
        command: 'test',
        description: 'test',
        expiresAt: Date.now() + 120_000,
      })
      result.current.updateCost({
        inputTokens: 100,
        outputTokens: 200,
        estimatedCostUsd: 0.01,
      })
      result.current.setToolCall({
        toolCallId: 'tc-1',
        toolName: 'test',
        input: {},
      })
      result.current.setGenerativeUI({
        component: 'MiniChart',
        props: { data: [], type: 'line' },
      })
    })

    act(() => {
      result.current.resetAll()
    })

    expect(result.current.approvalQueue).toHaveLength(0)
    expect(result.current.costData).toBeNull()
    expect(result.current.activeToolCall).toBeNull()
    expect(result.current.generativeUIPayload).toBeNull()
  })
})

describe('layoutStore responsive breakpoints', () => {
  beforeEach(() => {
    const state = useLayoutStore.getState()
    state.setSidebarCollapsed(false)
    state.setTerminalDrawerOpen(false)
    state.setViewportBreakpoint('md')
  })

  it('widthToBreakpoint returns correct breakpoints', () => {
    expect(widthToBreakpoint(800)).toBe('xs')
    expect(widthToBreakpoint(899)).toBe('xs')
    expect(widthToBreakpoint(900)).toBe('sm')
    expect(widthToBreakpoint(1199)).toBe('sm')
    expect(widthToBreakpoint(1200)).toBe('md')
    expect(widthToBreakpoint(1599)).toBe('md')
    expect(widthToBreakpoint(1600)).toBe('lg')
    expect(widthToBreakpoint(1919)).toBe('lg')
    expect(widthToBreakpoint(1920)).toBe('xl')
    expect(widthToBreakpoint(2560)).toBe('xl')
  })

  it('sets sidebar collapsed state', () => {
    const { result } = renderHook(() => useLayoutStore())

    act(() => {
      result.current.setSidebarCollapsed(true)
    })
    expect(result.current.sidebarCollapsed).toBe(true)

    act(() => {
      result.current.setSidebarCollapsed(false)
    })
    expect(result.current.sidebarCollapsed).toBe(false)
  })

  it('sets terminal drawer open state', () => {
    const { result } = renderHook(() => useLayoutStore())

    act(() => {
      result.current.setTerminalDrawerOpen(true)
    })
    expect(result.current.terminalDrawerOpen).toBe(true)

    act(() => {
      result.current.setTerminalDrawerOpen(false)
    })
    expect(result.current.terminalDrawerOpen).toBe(false)
  })

  it('sets viewport breakpoint', () => {
    const { result } = renderHook(() => useLayoutStore())

    act(() => {
      result.current.setViewportBreakpoint('xs')
    })
    expect(result.current.viewportBreakpoint).toBe('xs')

    act(() => {
      result.current.setViewportBreakpoint('xl')
    })
    expect(result.current.viewportBreakpoint).toBe('xl')
  })

  it('does not persist responsive state', () => {
    const { result } = renderHook(() => useLayoutStore())

    act(() => {
      result.current.setSidebarCollapsed(true)
      result.current.setTerminalDrawerOpen(true)
      result.current.setViewportBreakpoint('xs')
    })

    // These are runtime-only states, not persisted
    expect(result.current.sidebarCollapsed).toBe(true)
    expect(result.current.terminalDrawerOpen).toBe(true)
    expect(result.current.viewportBreakpoint).toBe('xs')
  })
})
