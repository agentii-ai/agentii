// T001 — Data Provider types

export type ProviderType = 'first-party' | 'third-party'
export type ProviderStatus = 'connected' | 'not-configured' | 'error' | 'unvalidated'

export interface CredentialField {
  name: string
  label: string
  type: 'text' | 'password'
  required: boolean
  placeholder?: string
}

export interface DataProviderDefinition {
  id: string
  name: string
  description: string
  baseUrl: string
  portalUrl: string
  providerType: ProviderType
  credentialFields: CredentialField[]
  logoIcon?: string
  validate: (credentials: Record<string, string>) => Promise<{ valid: boolean; error?: string }>
}

export interface DataProviderState {
  providerId: string
  status: ProviderStatus
  credentials: Record<string, string>
  lastValidated?: string
  errorMessage?: string
}
