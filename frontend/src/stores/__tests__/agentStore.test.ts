import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentStore } from '@/stores/agentStore'

describe('agentStore', () => {
  beforeEach(() => {
    act(() => {
      useAgentStore.setState({
        sessionId: 'main',
        messages: [],
        isStreaming: false,
        activeRunId: null,
        streamingText: '',
        pendingApproval: null,
        sessionTokens: { input: 0, output: 0 },
        estimatedCostUsd: 0,
        sessions: [],
      })
    })
  })

  it('adds a user message', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.addUserMessage('Hello')
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].type).toBe('user')
  })

  it('appends streaming delta', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.appendDelta('Hello ')
      result.current.appendDelta('world')
    })
    expect(result.current.streamingText).toBe('Hello world')
  })

  it('finalizes message from streaming text', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.appendDelta('Final answer')
      result.current.finalizeMessage({ text: '', citations: [] })
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].type).toBe('agent')
    expect(result.current.streamingText).toBe('')
  })

  it('sets streaming state with run_id', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.setStreaming(true, 'run-123')
    })
    expect(result.current.isStreaming).toBe(true)
    expect(result.current.activeRunId).toBe('run-123')

    act(() => {
      result.current.setStreaming(false)
    })
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.activeRunId).toBeNull()
  })

  it('adds and updates tool calls', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.addToolCall({
        type: 'tool_call',
        id: 'tc-1',
        toolCallId: 'tc-1',
        toolName: 'search',
        input: { query: 'test' },
        status: 'running',
      })
    })
    expect(result.current.messages).toHaveLength(1)

    act(() => {
      result.current.updateToolCall('tc-1', { status: 'success', output: 'found it' })
    })
    const tc = result.current.messages[0]
    expect(tc.type).toBe('tool_call')
    if (tc.type === 'tool_call') {
      expect(tc.status).toBe('success')
    }
  })

  it('updates cost', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.updateCost(1000, 500)
    })
    expect(result.current.sessionTokens.input).toBe(1000)
    expect(result.current.sessionTokens.output).toBe(500)
    expect(result.current.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('sets session ID', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.setSessionId('sess-abc')
    })
    expect(result.current.sessionId).toBe('sess-abc')
  })

  it('clears messages', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.addUserMessage('test')
      result.current.clearMessages()
    })
    expect(result.current.messages).toHaveLength(0)
  })

  it('adds reasoning message and appends delta', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.addReasoningMessage('think', 'Let me ')
    })
    expect(result.current.messages).toHaveLength(1)

    act(() => {
      result.current.appendReasoningDelta('think about this')
    })
    const msg = result.current.messages[0]
    if (msg.type === 'reasoning') {
      expect(msg.text).toBe('Let me think about this')
    }
  })

  it('sets and clears approval', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.setApproval({ requestId: 'req-1', command: 'rm -rf', expiresAt: Date.now() + 60000 })
    })
    expect(result.current.pendingApproval).not.toBeNull()

    act(() => {
      result.current.setApproval(null)
    })
    expect(result.current.pendingApproval).toBeNull()
  })

  it('adds error message', () => {
    const { result } = renderHook(() => useAgentStore())
    act(() => {
      result.current.addError({ type: 'error', id: 'err-1', message: 'Something failed', retryable: true })
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].type).toBe('error')
  })

  it('loads history', () => {
    const { result } = renderHook(() => useAgentStore())
    const history = [
      { type: 'user' as const, id: 'h-1', text: 'hi', attachments: [], timestamp: Date.now() },
      { type: 'agent' as const, id: 'h-2', text: 'hello', citations: [], timestamp: Date.now() },
    ]
    act(() => {
      result.current.loadHistory(history)
    })
    expect(result.current.messages).toHaveLength(2)
  })
})
