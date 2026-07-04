// T008 — Static data provider definitions
import type { DataProviderDefinition } from '@/types/data-provider'

export const DATA_PROVIDERS: DataProviderDefinition[] = [
  {
    id: 'alpaca',
    name: 'Alpaca Markets',
    description: 'Commission-free stock and options trading API with real-time and historical market data.',
    baseUrl: 'https://paper-api.alpaca.markets',
    portalUrl: 'https://app.alpaca.markets/brokerage/dashboard/overview',
    providerType: 'third-party',
    logoIcon: 'TrendingUp',
    credentialFields: [
      { name: 'apiKeyId', label: 'API Key ID', type: 'text', required: true, placeholder: 'PK...' },
      { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: 'Enter your secret key' },
    ],
    validate: async (creds) => {
      try {
        const res = await fetch('https://paper-api.alpaca.markets/v2/account', {
          headers: { 'APCA-API-KEY-ID': creds.apiKeyId ?? '', 'APCA-API-SECRET-KEY': creds.secretKey ?? '' },
        })
        if (res.ok) return { valid: true }
        return { valid: false, error: `Authentication failed (${res.status})` }
      } catch {
        return { valid: false, error: 'Network error — check your connection' }
      }
    },
  },
  {
    id: 'massive',
    name: 'Massive',
    description: 'Formerly Polygon.io — real-time and historical market data for stocks, options, forex, and crypto.',
    baseUrl: 'https://api.polygon.io',
    portalUrl: 'https://massive.com/dashboard',
    providerType: 'third-party',
    logoIcon: 'Database',
    credentialFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your API key' },
    ],
    validate: async (creds) => {
      try {
        const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=${creds.apiKey ?? ''}`)
        if (res.ok) return { valid: true }
        return { valid: false, error: `Authentication failed (${res.status})` }
      } catch {
        return { valid: false, error: 'Network error — check your connection' }
      }
    },
  },
  {
    id: 'agenzym',
    name: 'Agenzym',
    description: 'First-party biotech data — FDA decisions, clinical trials, catalyst events, and SEC filings for biotech equities.',
    baseUrl: 'https://api.agenzym.com',
    portalUrl: 'https://www.agenzym.com',
    providerType: 'first-party',
    logoIcon: 'FlaskConical',
    credentialFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Agenzym API key' },
    ],
    validate: async (creds) => {
      try {
        const res = await fetch('https://api.agenzym.com/v1/health', {
          headers: { Authorization: `Bearer ${creds.apiKey ?? ''}` },
        })
        if (res.ok) return { valid: true }
        return { valid: false, error: `Authentication failed (${res.status})` }
      } catch {
        return { valid: false, error: 'Network error — check your connection' }
      }
    },
  },
  {
    id: 'agentii',
    name: 'Agentii',
    description: 'First-party agent-use-ready data API — 500+ US stocks with pre-processed data optimized for AI agent consumption.',
    baseUrl: 'https://api.agentii.ai',
    portalUrl: 'https://www.agentii.ai',
    providerType: 'first-party',
    logoIcon: 'Bot',
    credentialFields: [
      { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Agentii API key' },
    ],
    validate: async (creds) => {
      try {
        const res = await fetch('https://api.agentii.ai/v1/health', {
          headers: { Authorization: `Bearer ${creds.apiKey ?? ''}` },
        })
        if (res.ok) return { valid: true }
        return { valid: false, error: `Authentication failed (${res.status})` }
      } catch {
        return { valid: false, error: 'Network error — check your connection' }
      }
    },
  },
]
