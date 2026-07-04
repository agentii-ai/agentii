// T008: Frontend TypeScript types for CLI readiness
// Matches the Frontend TypeScript Types section of data-model.md exactly.

/** Metadata about a supported CLI agent. */
export interface CliAgentProfile {
  id: string
  displayName: string
  binaryName: string
  launchCommand: string
  workingDir: string
  requiredKeyEnvVars: string[]
  supportsMcp: boolean
  configFilePath: string | null
  projectInstructionsPath: string
  skillsDirPath: string | null
  installCommand: string | null
  detectionCommand: string
}

/** Per-tab readiness state derived from VM status + key availability + CLI process health. */
export type CliReadinessState = 'connecting' | 'ready' | 'no-keys' | 'error'

/** Per-tab CLI state tracked in the terminal store. */
export interface CliTabState {
  tabId: string
  cliId: string
  readiness: CliReadinessState
  errorMessage?: string
  /** Names of env vars that were injected. */
  injectedKeys: string[]
}

/** Saved tab layout for a project. Restored on project reopen with fresh CLI processes. */
export interface PersistedTabLayout {
  projectId: string
  tabs: Array<{
    cliId: string
    position: number
    active: boolean
  }>
  savedAt: string
}

/** User settings extension for default CLI agent preference. */
export interface CliUserSettings {
  defaultCliAgent: string // default: 'goose'
}

/** Channel 2 event: cli.readiness_changed */
export interface CliReadinessChangedEvent {
  type: 'event'
  event: 'cli.readiness_changed'
  data: {
    tab_id: string
    cli_id: string
    state: CliReadinessState
    injected_keys: string[]
    error_message?: string
  }
}

/** Response from cli.list_installed RPC */
export interface CliListInstalledResponse {
  installed: Array<{
    id: string
    display_name: string
    version?: string
  }>
  missing: string[]
}
