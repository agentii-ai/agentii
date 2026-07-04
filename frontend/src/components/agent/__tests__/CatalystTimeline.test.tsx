import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CatalystTimeline } from '../CatalystTimeline'
import { MemoryRouter } from 'react-router-dom'
import type { CatalystEvent } from '@/types/biotech'

const events: CatalystEvent[] = [
  { id: 'cat-1', symbol: 'MRNA', company_name: 'Moderna Inc', drug_name: 'mRNA-1283', indication: 'COVID-19 Vaccine', catalyst_type: 'pdufa', event_date: '2026-04-15', date_is_estimated: false, description: null, approval_probability: 0.75, expected_move_pct: 15, therapeutic_area: 'Infectious Disease', source: null, source_url: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
  { id: 'cat-2', symbol: 'BNTX', company_name: 'BioNTech SE', drug_name: 'BNT162b4', indication: 'Pan-Coronavirus', catalyst_type: 'phase_3', event_date: '2026-05-01', date_is_estimated: true, description: null, approval_probability: 0.55, expected_move_pct: 20, therapeutic_area: 'Infectious Disease', source: null, source_url: null, created_at: '2026-01-15T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
]

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('CatalystTimeline', () => {
  it('renders events with symbols', () => {
    renderWithRouter(<CatalystTimeline events={events} />)
    expect(screen.getByText('MRNA')).toBeInTheDocument()
    expect(screen.getByText('BNTX')).toBeInTheDocument()
  })

  it('renders drug names and indications', () => {
    renderWithRouter(<CatalystTimeline events={events} />)
    expect(screen.getByText('mRNA-1283 — COVID-19 Vaccine')).toBeInTheDocument()
    expect(screen.getByText('BNT162b4 — Pan-Coronavirus')).toBeInTheDocument()
  })

  it('renders catalyst type badges', () => {
    renderWithRouter(<CatalystTimeline events={events} />)
    expect(screen.getByText('PDUFA')).toBeInTheDocument()
    expect(screen.getByText('PHASE 3')).toBeInTheDocument()
  })

  it('renders approval probability bars', () => {
    renderWithRouter(<CatalystTimeline events={events} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('55%')).toBeInTheDocument()
  })

  it('renders empty state for no events', () => {
    renderWithRouter(<CatalystTimeline events={[]} />)
    expect(screen.getByText('No upcoming catalyst events found.')).toBeInTheDocument()
  })
})
