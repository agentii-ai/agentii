import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenerativeUIOverlay } from '../GenerativeUIOverlay'
import type { GenerativeUIPayload } from '@/types/terminal'

// Mock GenerativeUI component
vi.mock('@/components/agent/GenerativeUI', () => ({
  GenerativeUI: ({ component, props }: { component: string; props: Record<string, unknown> }) => (
    <div data-testid="generative-ui" data-component={component}>
      {JSON.stringify(props)}
    </div>
  ),
}))

// Mock useWindowBus
vi.mock('@/hooks/useWindowBus', () => ({
  useWindowBus: () => ({ send: vi.fn(), subscribe: vi.fn() }),
}))

// Mock windowRegistryStore
vi.mock('@/stores/windowRegistryStore', () => ({
  useWindowRegistryStore: (selector: (s: { linkedPairs: [] }) => unknown) =>
    selector({ linkedPairs: [] }),
}))

describe('GenerativeUIOverlay', () => {
  const financialTablePayload: GenerativeUIPayload = {
    component: 'FinancialTable',
    props: {
      columns: [
        { key: 'seg', label: 'Segment', type: 'text' as const },
        { key: 'rev', label: 'Revenue', type: 'currency' as const },
      ],
      rows: [{ seg: 'Mounjaro', rev: 3100000000 }],
    },
  }

  it('renders nothing when payload is null', () => {
    const { container } = render(
      <GenerativeUIOverlay payload={null} onDismiss={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders GenerativeUI component with payload', () => {
    render(
      <GenerativeUIOverlay payload={financialTablePayload} onDismiss={vi.fn()} />,
    )
    expect(screen.getByTestId('generative-ui')).toBeDefined()
    expect(screen.getByTestId('generative-ui').dataset.component).toBe('FinancialTable')
  })

  it('shows component name in header', () => {
    render(
      <GenerativeUIOverlay payload={financialTablePayload} onDismiss={vi.fn()} />,
    )
    expect(screen.getByText('FinancialTable')).toBeDefined()
  })

  it('calls onDismiss when × button clicked', () => {
    const onDismiss = vi.fn()
    render(
      <GenerativeUIOverlay payload={financialTablePayload} onDismiss={onDismiss} />,
    )
    fireEvent.click(screen.getByLabelText('Dismiss overlay'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onDismiss on Escape key', () => {
    const onDismiss = vi.fn()
    render(
      <GenerativeUIOverlay payload={financialTablePayload} onDismiss={onDismiss} />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('has dialog role for accessibility', () => {
    render(
      <GenerativeUIOverlay payload={financialTablePayload} onDismiss={vi.fn()} />,
    )
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
