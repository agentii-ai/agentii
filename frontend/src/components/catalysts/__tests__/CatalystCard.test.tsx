import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CatalystCard } from '../CatalystCard'
import type { CatalystEvent } from '@/types/biotech'

const event: CatalystEvent = {
  id: 'cat-1',
  symbol: 'MRNA',
  company_name: 'Moderna Inc',
  drug_name: 'mRNA-1283',
  indication: 'COVID-19 Vaccine',
  catalyst_type: 'pdufa',
  event_date: '2026-04-15',
  date_is_estimated: false,
  description: 'PDUFA date for mRNA-1283',
  approval_probability: 0.75,
  expected_move_pct: 15,
  therapeutic_area: 'Infectious Disease',
  source: null,
  source_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

describe('CatalystCard', () => {
  it('renders event symbol and drug name', () => {
    render(<CatalystCard event={event} />)
    expect(screen.getByText('MRNA')).toBeInTheDocument()
    expect(screen.getByText('mRNA-1283')).toBeInTheDocument()
  })

  it('renders catalyst type badge', () => {
    render(<CatalystCard event={event} />)
    expect(screen.getByText('PDUFA')).toBeInTheDocument()
  })

  it('renders indication', () => {
    render(<CatalystCard event={event} />)
    expect(screen.getByText('COVID-19 Vaccine')).toBeInTheDocument()
  })

  it('renders approval probability', () => {
    render(<CatalystCard event={event} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders expected move', () => {
    render(<CatalystCard event={event} />)
    expect(screen.getByText('±15% expected')).toBeInTheDocument()
  })

  it('shows estimated flag when date is estimated', () => {
    const estimated = { ...event, date_is_estimated: true }
    render(<CatalystCard event={estimated} />)
    expect(screen.getByText('est.')).toBeInTheDocument()
  })

  it('handles null event_date', () => {
    const noDate = { ...event, event_date: null }
    render(<CatalystCard event={noDate} />)
    expect(screen.getByText('MRNA')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<CatalystCard event={event} onClick={onClick} />)
    ;(screen.getByText('MRNA').closest('[role="button"]') as HTMLElement)?.click()
    expect(onClick).toHaveBeenCalled()
  })
})
