import type {
  FinancialTableProps,
  MiniChartProps,
  CompanyCardProps,
  ComparisonGridProps,
  CatalystTimelineProps,
  SignalCardProps,
  ChartOverlayProps,
} from './generative-ui'

/** All supported CLI types for terminal sessions */
export type TerminalSessionType =
  | 'shell'
  | 'agentii-cli'
  | 'claude'
  | 'goose'
  | 'opencode'
  | 'codex'
  | 'agent-output'

export interface TerminalSession {
  id: string
  title: string
  type: TerminalSessionType
  status: 'running' | 'exited'
  exitCode?: number
}

export interface TerminalSize {
  rows: number
  cols: number
}

export type TerminalTheme = 'dark' | 'light'

/** Maximum concurrent terminal tabs per IDE window */
export const MAX_TERMINAL_TABS = 8

/** OSC escape sequence code for GenerativeUI payloads */
export const OSC_CODE = 7777

/** CLI profile metadata for the [+] dropdown */
export interface CliProfile {
  type: TerminalSessionType
  label: string
  icon: string
  command: string
  description: string
}

/** Known CLI profiles for the terminal tab [+] dropdown */
export const CLI_PROFILES: CliProfile[] = [
  { type: 'agentii-cli', label: 'Agentii', icon: 'bot', command: 'agentii', description: 'Agentii agentic CLI' },
  { type: 'goose', label: 'Goose', icon: 'bird', command: 'goose', description: 'Block Goose CLI' },
  { type: 'claude', label: 'Claude Code', icon: 'zap', command: 'claude', description: 'Anthropic Claude Code CLI' },
  { type: 'opencode', label: 'OpenCode', icon: 'code', command: 'opencode', description: 'OpenCode CLI' },
  { type: 'codex', label: 'Codex', icon: 'code', command: 'codex', description: 'OpenAI Codex CLI' },
  { type: 'shell', label: 'Bash', icon: 'terminal', command: 'bash', description: 'System shell' },
]

/** Union type for all GenerativeUI payloads delivered via OSC 7777 or Channel 2 */
export type GenerativeUIPayload =
  | { component: 'FinancialTable'; props: FinancialTableProps }
  | { component: 'MiniChart'; props: MiniChartProps }
  | { component: 'CompanyCard'; props: CompanyCardProps }
  | { component: 'ComparisonGrid'; props: ComparisonGridProps }
  | { component: 'CatalystTimeline'; props: CatalystTimelineProps }
  | { component: 'SignalCard'; props: SignalCardProps }
  | { component: 'ChartOverlay'; props: ChartOverlayProps }

// --- Channel 2 Structured API Event Types (agentii tabs only) ---

/** Approval request payload from Channel 2 */
export interface ApprovalRequestPayload {
  requestId: string
  command: string
  description: string
  expiresAt: number
}

/** Cost update payload from Channel 2 */
export interface CostUpdatePayload {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  budgetRemainingUsd?: number
}

/** Tool call start payload from Channel 2 */
export interface ToolCallStartPayload {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
}

/** Tool call end payload from Channel 2 */
export interface ToolCallEndPayload {
  toolCallId: string
  toolName: string
  success: boolean
  durationMs: number
  output?: string
  error?: string
}

/** Union type for all Channel 2 structured events from agentii serve */
export type AgentStructuredEvent =
  | { type: 'GENERATIVE_UI'; payload: GenerativeUIPayload }
  | { type: 'APPROVAL_REQUEST'; payload: ApprovalRequestPayload }
  | { type: 'COST_UPDATE'; payload: CostUpdatePayload }
  | { type: 'TOOL_CALL_START'; payload: ToolCallStartPayload }
  | { type: 'TOOL_CALL_END'; payload: ToolCallEndPayload }
