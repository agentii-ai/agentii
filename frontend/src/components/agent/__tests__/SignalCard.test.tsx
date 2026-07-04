import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SignalCard } from '../SignalCard'

describe('SignalCard', () => {
  it('renders symbol and side badge', () => {
    render(<SignalCard symbol="MRNA" side="buy" confidence={85} rationale="Strong catalyst setup" />)
    expect(screen.getByText('MRNA')).toBeInTheDocument()
    expect(screen.getByText('BUY')).toBeInTheDocument()
  })

  it('renders confidence percentage', () => {
    render(<SignalCard symbol="MRNA" side="buy" confidence={85} rationale="Strong catalyst setup" />)
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('renders rationale text', () => {
    render(<SignalCard symbol="MRNA" side="sell" confidence={40} rationale="Weak technicals" />)
    expect(screen.getByText('Weak technicals')).toBeInTheDocument()
  })

  it('renders sell badge with destructive variant', () => {
    render(<SignalCard symbol="SPY" side="sell" confidence={60} rationale="Bearish signal" />)
    expect(screen.getByText('SELL')).toBeInTheDocument()
  })

  it('renders order entry button', () => {
    render(<SignalCard symbol="MRNA" side="buy" confidence={75} rationale="Test" />)
    expect(screen.getByText('Open Order Entry')).toBeInTheDocument()
  })
})
