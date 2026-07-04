use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// T001: CliAgentProfile, CliEnvVar, CliEnvVarSource
// ---------------------------------------------------------------------------

/// How to derive a CLI-specific environment variable value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CliEnvVarSource {
    /// Value derived from the best available provider key.
    BestProvider,
    /// Value derived from the default model for the best available provider.
    BestModel,
    /// Static value (e.g., "auto" for GOOSE_MODE).
    Static(String),
}

/// A CLI-specific environment variable that needs to be injected at PTY spawn.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliEnvVar {
    /// Environment variable name (e.g., "GOOSE_PROVIDER").
    pub name: String,
    /// How to derive the value.
    pub source: CliEnvVarSource,
}

/// Metadata about a supported CLI agent — its binary, config, key requirements, and launch behavior.
/// Stored in cli_registry.rs as a static registry. Shared via agentii-protocol.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliAgentProfile {
    /// Internal identifier (e.g., "goose", "claude", "opencode", "codex", "bash").
    pub id: String,
    /// Display name shown in the tab bar and "+" dropdown (e.g., "Goose", "Claude Code").
    pub display_name: String,
    /// Binary name to detect on PATH inside the VM.
    pub binary_name: String,
    /// Command to launch the CLI in interactive mode (e.g., "goose", "claude").
    pub launch_command: String,
    /// Arguments to pass to the launch command (usually empty for interactive mode).
    #[serde(default)]
    pub launch_args: Vec<String>,
    /// Working directory inside the VM (always "/workspace/").
    pub working_dir: String,
    /// Environment variable names this CLI requires for LLM API access.
    /// Used to determine "ready" vs "no-keys" state.
    #[serde(default)]
    pub required_key_env_vars: Vec<String>,
    /// All environment variable names this CLI can use (superset of required).
    #[serde(default)]
    pub supported_key_env_vars: Vec<String>,
    /// Whether this CLI supports MCP servers natively.
    pub supports_mcp: bool,
    /// Path to CLI-specific config file inside the VM (e.g., "~/.config/goose/config.yaml").
    pub config_file_path: Option<String>,
    /// Path to CLI's native project instructions file in the workspace.
    pub project_instructions_path: String,
    /// Path to CLI's native skill directory (if any). Used for symlink target.
    pub skills_dir_path: Option<String>,
    /// Command to install this CLI if missing from the base image.
    pub install_command: Option<String>,
    /// Detection command to verify installation (e.g., "goose --version").
    pub detection_command: String,
    /// Default model per provider. Key = provider id, Value = model id.
    #[serde(default)]
    pub default_models: HashMap<String, String>,
    /// CLI-specific env vars beyond API keys (e.g., GOOSE_PROVIDER, GOOSE_MODEL).
    #[serde(default)]
    pub extra_env_vars: Vec<CliEnvVar>,
}

// ---------------------------------------------------------------------------
// T002: KeyProviderMapping
// ---------------------------------------------------------------------------

/// Maps API key environment variables to CLI-specific provider identifiers.
/// Used by CliKeyMapper to build the env var set for each CLI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyProviderMapping {
    /// The environment variable name (e.g., "ANTHROPIC_API_KEY").
    pub env_var: &'static str,
    /// The provider identifier for Goose (e.g., "anthropic").
    pub goose_provider_id: Option<&'static str>,
    /// Priority order (1 = highest). Used when multiple keys are available.
    pub priority: u8,
    /// Default model for this provider, optimized for financial analysis.
    pub default_model: &'static str,
}

/// Static mapping table for all supported providers (7 providers).
pub const KEY_PROVIDER_MAPPINGS: &[KeyProviderMapping] = &[
    KeyProviderMapping {
        env_var: "ANTHROPIC_API_KEY",
        goose_provider_id: Some("anthropic"),
        priority: 1,
        default_model: "claude-sonnet-4",
    },
    KeyProviderMapping {
        env_var: "OPENAI_API_KEY",
        goose_provider_id: Some("openai"),
        priority: 2,
        default_model: "gpt-4o",
    },
    KeyProviderMapping {
        env_var: "DEEPSEEK_API_KEY",
        goose_provider_id: Some("deepseek"),
        priority: 3,
        default_model: "deepseek-chat",
    },
    KeyProviderMapping {
        env_var: "GOOGLE_API_KEY",
        goose_provider_id: Some("google"),
        priority: 4,
        default_model: "gemini-2.0-flash",
    },
    KeyProviderMapping {
        env_var: "GROQ_API_KEY",
        goose_provider_id: Some("groq"),
        priority: 5,
        default_model: "llama-3.3-70b",
    },
    KeyProviderMapping {
        env_var: "MISTRAL_API_KEY",
        goose_provider_id: Some("mistral"),
        priority: 6,
        default_model: "mistral-large",
    },
    KeyProviderMapping {
        env_var: "OPENROUTER_API_KEY",
        goose_provider_id: Some("openrouter"),
        priority: 7,
        default_model: "anthropic/claude-sonnet-4",
    },
];

// Workaround: const arrays of structs with String/Option<String> require
// a helper since String isn't const-constructible. We use &str in the const
// and provide a helper to convert.
impl KeyProviderMapping {
    /// Find the mapping for a given env var name.
    pub fn find(env_var: &str) -> Option<&'static KeyProviderMapping> {
        KEY_PROVIDER_MAPPINGS.iter().find(|m| m.env_var == env_var)
    }

    /// Get all mappings sorted by priority (ascending = highest priority first).
    pub fn all_by_priority() -> &'static [KeyProviderMapping] {
        KEY_PROVIDER_MAPPINGS
    }
}

// ---------------------------------------------------------------------------
// T003: CliReadinessState
// ---------------------------------------------------------------------------

/// Per-tab readiness state. Derived from VM status + key availability + CLI process health.
/// Emitted as Channel 2 events to the frontend for tab status indicators.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CliReadinessState {
    /// VM booting or CLI process starting. Yellow pulse indicator.
    Connecting,
    /// CLI running and at least one relevant API key injected. Green indicator.
    Ready,
    /// CLI running but no relevant API key injected. Amber indicator with hint.
    NoKeys,
    /// CLI failed to start or process exited with error. Red indicator.
    Error(String),
}

// ---------------------------------------------------------------------------
// T004: PersistedTabLayout and PersistedTab
// ---------------------------------------------------------------------------

/// Saved tab layout for a project. Restored on project reopen with fresh CLI processes.
/// Stored in terminalStore.ts (frontend) and persisted to local storage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTabLayout {
    /// Project UUID this layout belongs to.
    pub project_id: String,
    /// Ordered list of tabs.
    pub tabs: Vec<PersistedTab>,
    /// Timestamp of last save.
    pub saved_at: String,
}

/// A single persisted tab entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTab {
    /// CLI agent ID (e.g., "goose", "claude", "bash").
    pub cli_id: String,
    /// Tab position (0-indexed, left to right).
    pub position: u32,
    /// Whether this tab was the active/focused tab.
    pub active: bool,
}

// ---------------------------------------------------------------------------
// T006: CliReadinessChangedEvent and CliListInstalledResponse
// ---------------------------------------------------------------------------

/// Channel 2 event emitted when CLI readiness state changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliReadinessChangedEvent {
    /// Event type identifier.
    #[serde(rename = "type")]
    pub event_type: String,
    /// Event name.
    pub event: String,
    /// Event payload.
    pub data: CliReadinessChangedData,
}

/// Payload for cli.readiness_changed event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliReadinessChangedData {
    /// Terminal tab ID.
    pub tab_id: String,
    /// CLI agent ID.
    pub cli_id: String,
    /// Current readiness state.
    pub state: CliReadinessState,
    /// Names of env vars that were injected.
    #[serde(default)]
    pub injected_keys: Vec<String>,
    /// Error message (only when state is Error).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

impl CliReadinessChangedEvent {
    pub fn new(tab_id: String, cli_id: String, state: CliReadinessState, injected_keys: Vec<String>) -> Self {
        let error_message = match &state {
            CliReadinessState::Error(msg) => Some(msg.clone()),
            _ => None,
        };
        Self {
            event_type: "event".into(),
            event: "cli.readiness_changed".into(),
            data: CliReadinessChangedData {
                tab_id,
                cli_id,
                state,
                injected_keys,
                error_message,
            },
        }
    }
}

/// Response for cli.list_installed RPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliListInstalledResponse {
    /// CLIs that are installed and available.
    pub installed: Vec<CliInstalledEntry>,
    /// CLIs that are missing from the VM.
    #[serde(default)]
    pub missing: Vec<String>,
}

/// A single installed CLI entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliInstalledEntry {
    pub id: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}
