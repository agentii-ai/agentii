/** IDE window state types */

export type SidePanelView = 'files' | 'watchlist' | 'search' | 'memory' | 'catalysts' | 'settings' | 'instructions'

export interface FileTab {
  id: string
  filePath: string
  fileName: string
  isDirty: boolean
  isPreview: boolean
  cursorPos: number
  scrollTop: number
  viewMode: 'source' | 'preview' | 'split'
}

export interface PanelSizes {
  sidePanel: number
  editor: number
  agentPanel: number
}

export interface FileTreeNode {
  id: string
  name: string
  children?: FileTreeNode[]
  isDirectory: boolean
  extension: string | null
  size?: number
  modified?: number
  pinned?: boolean
}

export interface IDEWindowState {
  windowId: string
  projectPath: string | null
  projectTicker: string | null
  activeSidePanel: SidePanelView | null
  activeFileTab: string | null
  openTabs: FileTab[]
  panelSizes: PanelSizes
  agentSessionKey: string
  linkedTradingWindowId: string | null
}

export interface WindowDescriptor {
  windowId: string
  windowType: 'ide' | 'trading'
  ticker: string | null
  title: string
}

export type WindowMessage =
  | { type: 'CHART_OVERLAY'; targetTicker: string; overlay: AgentChartOverlay }
  | { type: 'ADD_INDICATOR'; targetTicker: string; indicator: Record<string, unknown> }
  | { type: 'CHART_SELECTION'; sourceTicker: string; from: number; to: number; timeRange: [string, string] }
  | { type: 'TICKER_CHANGED'; windowId: string; newTicker: string }
  | { type: 'LINK_WINDOWS'; ideWindowId: string; tradingWindowId: string; ticker: string }
  | { type: 'UNLINK_WINDOWS'; ideWindowId: string; tradingWindowId: string }
  | { type: 'WINDOW_OPENED'; descriptor: WindowDescriptor }
  | { type: 'WINDOW_CLOSED'; windowId: string }
  | { type: 'IDE_PROJECT_CLAIM'; projectId: string; tabId: string }
  | { type: 'IDE_PROJECT_CLAIMED'; projectId: string; tabId: string }
  | { type: 'IDE_FOCUS_REQUEST'; tabId: string }

export interface AgentChartOverlay {
  label: string
  data: { time: string; value: number }[]
  color: string
  lineWidth?: number
  type: 'line' | 'histogram' | 'area'
}
