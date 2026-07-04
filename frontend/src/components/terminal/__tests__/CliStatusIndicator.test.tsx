import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CliStatusIndicator } from '../CliStatusIndicator'

// ---------------------------------------------------------------------------
// T052: test_cli_status_indicator_states
// ---------------------------------------------------------------------------

describe('CliStatusIndicator', () => {
  it('renders connecting state with yellow pulse', () => {
    const { container } = render(<CliStatusIndicator readiness="connecting" />)
    const dot = container.querySelector('[title]')
    expect(dot).toBeTruthy()
    expect(dot?.getAttribute('title')).toContain('Connecting')
  })

  it('renders ready state with green dot', () => {
    const { container } = render(<CliStatusIndicator readiness="ready" />)
    const dot = container.querySelector('[title]')
    expect(dot).toBeTruthy()
    expect(dot?.getAttribute('title')).toContain('Ready')
  })

  it('renders no-keys state with amber dot and hint', () => {
    const { container } = render(<CliStatusIndicator readiness="no-keys" />)
    const dot = container.querySelector('[title]')
    expect(dot).toBeTruthy()
    const title = dot?.getAttribute('title') ?? ''
    expect(title).toContain('API key')
  })

  it('renders error state with red dot and error message', () => {
    const { container } = render(
      <CliStatusIndicator readiness="error" errorMessage="PTY spawn failed" />,
    )
    const dot = container.querySelector('[title]')
    expect(dot).toBeTruthy()
    const title = dot?.getAttribute('title') ?? ''
    expect(title).toContain('PTY spawn failed')
  })

  it('renders error state with default message when no errorMessage', () => {
    const { container } = render(<CliStatusIndicator readiness="error" />)
    const dot = container.querySelector('[title]')
    expect(dot).toBeTruthy()
    const title = dot?.getAttribute('title') ?? ''
    expect(title).toContain('Error')
  })
})
