import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActivityBar } from '@/components/layout/ActivityBar'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ActivityBar', () => {
  const defaultProps = {
    terminalPanelVisible: false,
    onToggleTerminal: vi.fn(),
  }

  it('renders Group B IDE route icons', () => {
    renderWithRouter(<ActivityBar {...defaultProps} />)
    expect(screen.getByTitle('Projects')).toBeDefined()
    expect(screen.getByTitle('Search')).toBeDefined()
    expect(screen.getByTitle('Memory')).toBeDefined()
  })

  it('renders Group A trading route icons', () => {
    renderWithRouter(<ActivityBar {...defaultProps} />)
    expect(screen.getByTitle('Dashboard')).toBeDefined()
    expect(screen.getByTitle('Options')).toBeDefined()
    expect(screen.getByTitle('Biotech Catalysts')).toBeDefined()
    expect(screen.getByTitle('Portfolio')).toBeDefined()
  })

  it('calls onToggleTerminal when terminal button clicked', () => {
    const onToggleTerminal = vi.fn()
    renderWithRouter(<ActivityBar {...defaultProps} onToggleTerminal={onToggleTerminal} />)
    fireEvent.click(screen.getByLabelText('Toggle Terminal'))
    expect(onToggleTerminal).toHaveBeenCalled()
  })

  it('has toolbar role for accessibility', () => {
    renderWithRouter(<ActivityBar {...defaultProps} />)
    expect(screen.getByRole('toolbar')).toBeDefined()
  })

  it('does not render duplicate catalysts icon', () => {
    renderWithRouter(<ActivityBar {...defaultProps} />)
    // Only one catalysts entry — Biotech Catalysts in Group A
    const links = screen.getAllByRole('link')
    const catalystLinks = links.filter((l) => l.getAttribute('title')?.includes('Catalysts'))
    expect(catalystLinks.length).toBe(1)
  })
})
