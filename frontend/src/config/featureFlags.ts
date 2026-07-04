/**
 * Feature flags for Agentii frontend.
 *
 * Verified 2026-03-20 (T100): No active code paths import deprecated chat components.
 * ChatPanel.tsx → AgentChatPanel.tsx chain is dead code. Layout.tsx uses TerminalPanel.
 *
 * Import graph of deprecated modules (all self-referential, no active consumers):
 *   agentStore          ← useAgentChat, useAgentEvent, useAgentSessions, AgentChatPanel, agentStore.test.ts
 *   useAgentChat        ← AgentChatPanel
 *   useAgentEvent       ← AgentChatPanel
 *   useAgentSessions    ← AgentChatPanel
 *   AgentChatPanel      ← ChatPanel.tsx
 *   ChatPanel.tsx       ← (nothing — dead code, not imported by Layout.tsx or any route)
 *
 * Layout.tsx:3 imports TerminalPanel exclusively. No page, route, or layout component
 * imports any deprecated module. The feature flag exists as a safety net only.
 */

/**
 * Returns true if the legacy React chat panel should be rendered instead of
 * the terminal-based agent panel. Defaults to false (terminal panel is default).
 *
 * Set VITE_LEGACY_CHAT_PANEL=true in .env.development to re-enable.
 */
export function isLegacyChatEnabled(): boolean {
  return import.meta.env.VITE_LEGACY_CHAT_PANEL === 'true'
}
