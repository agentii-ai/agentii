import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCatalystMarkers } from '../useCatalystMarkers'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CatalystEvent } from '@/types/biotech'

vi.mock('@/api/catalysts', () => ({
  useCatalysts: vi.fn(() => ({
    data: [
      {
        id: 'cat-1',
        symbol: 'MRNA',
        company_name: 'Moderna Inc',
        drug_name: 'mRNA-1283',
        indication: 'COVID-19 Vaccine',
        catalyst_type: 'pdufa',
        event_date: '2026-04-15',
        date_is_estimated: false,
        description: null,
        approval_probability: 0.75,
        expected_move_pct: 15,
        therapeutic_area: 'Infectious Disease',
        source: null,
        source_url: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      } as CatalystEvent,
      {
        id: 'cat-2',
        symbol: 'BNTX',
        company_name: 'BioNTech SE',
        drug_name: 'BNT162b4',
        indication: 'Pan-Coronavirus',
        catalyst_type: 'phase_3',
        event_date: '2026-05-01',
        date_is_estimated: true,
        description: null,
        approval_probability: 0.55,
        expected_move_pct: 20,
        therapeutic_area: 'Infectious Disease',
        source: null,
        source_url: null,
        created_at: '2026-01-15T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      } as CatalystEvent,
      {
        id: 'cat-3',
        symbol: 'MRNA',
        company_name: 'Moderna Inc',
        drug_name: 'mRNA-4157',
        indication: 'Melanoma',
        catalyst_type: 'adcom',
        event_date: '2026-06-15',
        date_is_estimated: false,
        description: null,
        approval_probability: 0.65,
        expected_move_pct: 12,
        therapeutic_area: 'Oncology',
        source: null,
        source_url: null,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      } as CatalystEvent,
    ],
    isLoading: false,
  })),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useCatalystMarkers', () => {
  it('returns empty array when symbol is null', () => {
    const { result } = renderHook(() => useCatalystMarkers(null), { wrapper })
    expect(result.current).toEqual([])
  })

  it('filters markers by symbol', () => {
    const { result } = renderHook(() => useCatalystMarkers('MRNA'), { wrapper })
    expect(result.current).toHaveLength(2)
    expect(result.current.every((m) => m.catalyst.symbol === 'MRNA')).toBe(true)
  })

  it('maps PDUFA to red arrowDown marker', () => {
    const { result } = renderHook(() => useCatalystMarkers('MRNA'), { wrapper })
    const pdufa = result.current.find((m) => m.catalyst.catalyst_type === 'pdufa')
    expect(pdufa?.color).toBe('#ef4444')
    expect(pdufa?.shape).toBe('arrowDown')
    expect(pdufa?.position).toBe('aboveBar')
  })

  it('maps AdCom to orange square marker', () => {
    const { result } = renderHook(() => useCatalystMarkers('MRNA'), { wrapper })
    const adcom = result.current.find((m) => m.catalyst.catalyst_type === 'adcom')
    expect(adcom?.color).toBe('#f97316')
    expect(adcom?.shape).toBe('square')
  })

  it('maps Phase 3 to blue circle marker', () => {
    const { result } = renderHook(() => useCatalystMarkers('BNTX'), { wrapper })
    const phase3 = result.current.find((m) => m.catalyst.catalyst_type === 'phase_3')
    expect(phase3?.color).toBe('#3b82f6')
    expect(phase3?.shape).toBe('circle')
  })

  it('includes event_date as time', () => {
    const { result } = renderHook(() => useCatalystMarkers('MRNA'), { wrapper })
    expect(result.current[0]?.time).toBe('2026-04-15')
  })

  it('includes catalyst event in marker', () => {
    const { result } = renderHook(() => useCatalystMarkers('MRNA'), { wrapper })
    expect(result.current[0]?.catalyst.drug_name).toBe('mRNA-1283')
  })

  it('includes marker id', () => {
    const { result } = renderHook(() => useCatalystMarkers('MRNA'), { wrapper })
    expect(result.current[0]?.id).toBe('cat-1')
  })
})
