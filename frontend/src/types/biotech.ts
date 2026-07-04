import type { CatalystType, FDADecisionOutcome } from './enums'

export interface CatalystEvent {
  id: string
  symbol: string
  company_name: string
  drug_name: string
  indication: string
  catalyst_type: CatalystType
  event_date: string | null
  date_is_estimated: boolean
  description: string | null
  approval_probability: number | null
  expected_move_pct: number | null
  therapeutic_area: string | null
  source: string | null
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface FDADecision {
  id: string
  catalyst_event_id: string
  symbol: string
  drug_name: string
  indication: string
  outcome: FDADecisionOutcome
  decision_date: string
  details: string | null
  price_before: number | null
  price_after: number | null
  actual_move_pct: number | null
  application_number: string | null
  review_priority: string | null
}
