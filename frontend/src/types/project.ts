export interface Project {
  id: string
  owner_id: string
  name: string
  ticker_symbols: string[]
  project_type: 'us_stock' | 'us_stock_option' | 'crypto' | 'predictive_market'
  description: string | null
  is_featured: boolean
  is_template: boolean
  file_count: number
  session_count: number
  created_at: string
  updated_at: string
  archived_at: string | null
  metadata: Record<string, unknown>
}

export interface AgentSessionRecord {
  id: string
  project_id: string
  user_id: string
  title: string | null
  provider_id: string | null
  created_at: string
  updated_at: string
  message_count: number
  metadata: Record<string, unknown>
}

export interface ProviderKeyInfo {
  provider_name: string
  is_validated: boolean
  validated_at: string | null
}

export type ProjectType = Project['project_type']
export type ViewMode = 'grid' | 'table'
