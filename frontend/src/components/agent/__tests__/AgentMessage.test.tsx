import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentMessage } from '@/components/agent/AgentMessage'
import type { AgentTextMessage } from '@/types/agent'

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('remark-gfm', () => ({ default: () => {} }))

describe('AgentMessage', () => {
  const baseMessage: AgentTextMessage = {
    type: 'agent',
    id: 'msg-1',
    text: 'Hello, this is a response.',
    citations: [],
    timestamp: Date.now(),
  }

  it('renders message text', () => {
    render(<AgentMessage message={baseMessage} />)
    expect(screen.getByTestId('markdown')).toBeDefined()
  })

  it('shows streaming cursor when streamingText provided', () => {
    render(<AgentMessage message={baseMessage} streamingText="Streaming..." />)
    expect(screen.getByText('Streaming...')).toBeDefined()
  })

  it('shows duration when available', () => {
    render(<AgentMessage message={{ ...baseMessage, durationMs: 2340, model: 'claude-sonnet' }} />)
    expect(screen.getByText(/2.3s/)).toBeDefined()
  })
})
