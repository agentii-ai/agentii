import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOSCBridge } from '@/hooks/useOSCBridge'

describe('useOSCBridge', () => {
  it('registers OSC handler on terminal', () => {
    const dispose = vi.fn()
    const registerOscHandler = vi.fn(() => ({ dispose }))
    const mockTerminal = {
      parser: { registerOscHandler },
    } as unknown as import('@xterm/xterm').Terminal

    const onPayload = vi.fn()

    const { unmount } = renderHook(() =>
      useOSCBridge({ terminal: mockTerminal, onPayload }),
    )

    expect(registerOscHandler).toHaveBeenCalledWith(7777, expect.any(Function))

    unmount()
    expect(dispose).toHaveBeenCalled()
  })

  it('parses valid JSON and calls onPayload', () => {
    let handler: ((data: string) => boolean) | null = null
    const registerOscHandler = vi.fn((_code: number, fn: (data: string) => boolean) => {
      handler = fn
      return { dispose: vi.fn() }
    })
    const mockTerminal = {
      parser: { registerOscHandler },
    } as unknown as import('@xterm/xterm').Terminal

    const onPayload = vi.fn()

    renderHook(() => useOSCBridge({ terminal: mockTerminal, onPayload }))

    expect(handler).not.toBeNull()
    const result = handler!('{"component":"FinancialTable","props":{"columns":[],"rows":[]}}')
    expect(result).toBe(true)
    expect(onPayload).toHaveBeenCalledWith({
      component: 'FinancialTable',
      props: { columns: [], rows: [] },
    })
  })

  it('ignores malformed JSON', () => {
    let handler: ((data: string) => boolean) | null = null
    const registerOscHandler = vi.fn((_code: number, fn: (data: string) => boolean) => {
      handler = fn
      return { dispose: vi.fn() }
    })
    const mockTerminal = {
      parser: { registerOscHandler },
    } as unknown as import('@xterm/xterm').Terminal

    const onPayload = vi.fn()

    renderHook(() => useOSCBridge({ terminal: mockTerminal, onPayload }))

    const result = handler!('not valid json{{{')
    expect(result).toBe(true)
    expect(onPayload).not.toHaveBeenCalled()
  })

  it('does nothing when terminal is null', () => {
    const onPayload = vi.fn()
    renderHook(() => useOSCBridge({ terminal: null, onPayload }))
    // No error thrown, no handler registered
    expect(onPayload).not.toHaveBeenCalled()
  })
})
