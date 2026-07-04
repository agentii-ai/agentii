import { supabase } from '@/lib/supabase'
import agentiiTemplate from '../../../../templates/agentii-template.md?raw'

// Templates are stored in /templates/agentii-md/ at repo root
// This service generates workspace files when a project is created

const AGENTII_DIRS = ['sessions', 'snapshots', '.agentii/skills']

interface ScaffoldInput {
  projectId: string
  ownerId: string
  name: string
  tickerSymbols: string[]
  projectType: 'us_stock' | 'us_stock_option' | 'crypto' | 'predictive_market'
  description?: string | null
  sector?: string
}

const PROJECT_TYPE_LABELS: Record<ScaffoldInput['projectType'], string> = {
  us_stock: 'US Stock',
  us_stock_option: 'US Stock Option',
  crypto: 'Crypto',
  predictive_market: 'Predictive Market',
}

const TYPE_SPECIFIC_GOALS: Record<ScaffoldInput['projectType'], string> = {
  us_stock: `- [ ] Review recent SEC filings (10-K, 10-Q, 8-K) for material changes
- [ ] Track earnings dates, guidance, and analyst consensus
- [ ] Identify key support/resistance levels and volume patterns`,
  us_stock_option: `- [ ] Analyze IV rank/percentile and skew across strikes
- [ ] Document underlying thesis and directional bias
- [ ] Define strike selection, expiry, and position sizing for defined-risk strategies`,
  crypto: `- [ ] Monitor on-chain metrics (active addresses, exchange flows, staking ratios)
- [ ] Track funding rates and basis across major venues
- [ ] Document 24/7 trading plan and risk management for high volatility`,
  predictive_market: `- [ ] Document resolution criteria and authoritative sources
- [ ] Track market-implied probability vs own estimate
- [ ] Identify edge from information asymmetry or mispricing`,
}

const TYPE_SPECIFIC_CONSTRAINTS: Record<ScaffoldInput['projectType'], string> = {
  us_stock: `- Use edgartools MCP for SEC EDGAR data retrieval
- Prefer 10-K/10-Q filings over earnings call transcripts for hard numbers
- Document all assumptions with sources`,
  us_stock_option: `- Always document underlying thesis before selecting strikes/expiries
- Prefer defined-risk strategies (spreads, condors) over naked options
- Track IV changes and theta decay daily for short-dated positions`,
  crypto: `- Distinguish on-chain data (blockchain explorers) from exchange data (CEX APIs)
- Account for 24/7 trading and weekend volatility in risk management
- Document venue fragmentation and liquidity differences`,
  predictive_market: `- Resolution criteria must be unambiguous and verifiable
- Separate market-implied probability from your own estimate
- Document information sources and update frequency`,
}

const TYPE_SPECIFIC_WORKFLOW: Record<ScaffoldInput['projectType'], string> = {
  us_stock: `1. Review latest SEC filings via edgartools MCP
2. Check earnings calendar and analyst estimates
3. Analyze price action, volume, and key levels
4. Document thesis, catalysts, and risk factors
5. Set alerts for material events (filings, earnings, guidance)`,
  us_stock_option: `1. Define underlying thesis and directional bias
2. Analyze IV rank, skew, and term structure
3. Select strikes and expiries based on thesis and risk tolerance
4. Document position sizing and max loss for defined-risk strategies
5. Track daily: underlying price, IV changes, theta decay, P&L`,
  crypto: `1. Review on-chain metrics (active addresses, exchange flows, staking)
2. Check funding rates and basis across major venues (Binance, Coinbase, Kraken)
3. Analyze price action and volume across 24/7 trading
4. Document thesis, catalysts, and tail risks
5. Set alerts for on-chain events and funding rate changes`,
  predictive_market: `1. Document resolution criteria and authoritative sources
2. Calculate market-implied probability from current prices
3. Build your own estimate from base rates and evidence
4. Identify edge: information asymmetry, mispricing, or timing
5. Track: market probability, your estimate, new information, resolution date`,
}

const TYPE_SPECIFIC_NOTES: Record<ScaffoldInput['projectType'], string> = {
  us_stock: '<!-- Add notes on recent filings, earnings, or catalysts here -->',
  us_stock_option: '<!-- Add notes on IV analysis, strike selection, or position Greeks here -->',
  crypto: '<!-- Add notes on on-chain metrics, funding rates, or venue analysis here -->',
  predictive_market: '<!-- Add notes on resolution criteria, probability estimates, or edge sources here -->',
}

function generateAgentiiMd(input: ScaffoldInput): string {
  const primaryTicker = input.tickerSymbols[0] || 'N/A'
  const sector = input.sector || (input.tickerSymbols.length > 0 ? 'TBD' : 'N/A')
  const description = input.description || 'N/A'
  const createdDate = new Date().toISOString().split('T')[0]

  let content = agentiiTemplate
    .replace(/\{\{project_name\}\}/g, input.name)
    .replace(/\{\{project_type_label\}\}/g, PROJECT_TYPE_LABELS[input.projectType])
    .replace(/\{\{project_type\}\}/g, input.projectType)
    .replace(/\{\{ticker_symbols\}\}/g, input.tickerSymbols.join(', ') || 'None')
    .replace(/\{\{primary_ticker\}\}/g, primaryTicker)
    .replace(/\{\{sector\}\}/g, sector)
    .replace(/\{\{description\}\}/g, description)
    .replace(/\{\{created_date\}\}/g, createdDate)
    .replace(/\{\{type_specific_goals\}\}/g, TYPE_SPECIFIC_GOALS[input.projectType])
    .replace(/\{\{type_specific_constraints\}\}/g, TYPE_SPECIFIC_CONSTRAINTS[input.projectType])
    .replace(/\{\{type_specific_workflow\}\}/g, TYPE_SPECIFIC_WORKFLOW[input.projectType])
    .replace(/\{\{notes_seed\}\}/g, TYPE_SPECIFIC_NOTES[input.projectType])

  return content
}

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_HTTP_URL || 'http://localhost:3100'

export async function scaffoldWorkspace(input: ScaffoldInput): Promise<void> {
  const basePath = `${input.projectId}`

  // 1. Generate agentii.md from template
  const agentiiMd = generateAgentiiMd(input)

  // 2. Initialize local workspace on the gateway FIRST (blocking).
  //    This creates ~/.agentii/workspaces/local/{project_id}/agentii.md
  //    so the file tree and terminal see the same files immediately.
  await initLocalWorkspace(input.projectId, input.ownerId, agentiiMd)

  // 3. Upload to Supabase Storage in background (non-blocking backup).
  //    Don't await — this is for cloud sync, not for the local experience.
  const agentiiBlob = new Blob([agentiiMd], { type: 'text/markdown' })
  supabase.storage.from('project-files').upload(`${basePath}/agentii.md`, agentiiBlob).catch((err) => {
    console.warn('Supabase storage upload failed (non-fatal):', err)
  })

  // Create .agentii directory structure in Supabase (background)
  for (const dir of AGENTII_DIRS) {
    const placeholder = new Blob([''], { type: 'text/plain' })
    supabase.storage.from('project-files').upload(`${basePath}/${dir}/.gitkeep`, placeholder).catch(() => {})
  }
}

/**
 * POST to the gateway to create the local workspace directory and write agentii.md.
 * This MUST succeed before the frontend navigates to the IDE page.
 */
async function initLocalWorkspace(
  projectId: string,
  userId: string,
  agentiiMd: string,
): Promise<void> {
  const resp = await fetch(`${GATEWAY_URL}/api/workspace/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      user_id: userId,
      agentii_md: agentiiMd,
    }),
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gateway workspace init failed: ${err}`)
  }
}
