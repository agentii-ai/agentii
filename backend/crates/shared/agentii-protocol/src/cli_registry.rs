use serde::{Deserialize, Serialize};

/// Known CLI agent entry with install/detection commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliEntry {
    /// CLI name (e.g. "goose", "opencode", "claude", "codex").
    pub name: String,
    /// Human-readable display name.
    pub display_name: String,
    /// Command to install this CLI inside the VM.
    pub install_command: String,
    /// Command to detect if installed (e.g. "which goose").
    pub detection_command: String,
    /// Config format for MCP injection.
    pub config_format: CliConfigFormat,
}

/// How a CLI reads MCP server configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CliConfigFormat {
    /// Goose: ~/.config/goose/profiles.yaml
    GooseProfilesYaml,
    /// OpenCode: opencode MCP config
    OpenCodeConfig,
    /// Claude Code: .claude/settings.json mcpServers
    ClaudeSettingsJson,
    /// Codex: codex MCP config
    CodexConfig,
    /// Agentii: native config (post-MVP)
    AgentiiConfig,
    /// No MCP config support.
    None,
}

/// Default CLI registry with known agent CLIs.
pub fn default_cli_registry() -> Vec<CliEntry> {
    vec![
        CliEntry {
            name: "goose".into(),
            display_name: "Goose".into(),
            install_command: "pipx install goose-ai".into(),
            detection_command: "which goose".into(),
            config_format: CliConfigFormat::GooseProfilesYaml,
        },
        CliEntry {
            name: "opencode".into(),
            display_name: "OpenCode".into(),
            install_command: "bun install -g opencode".into(),
            detection_command: "which opencode".into(),
            config_format: CliConfigFormat::OpenCodeConfig,
        },
        CliEntry {
            name: "claude".into(),
            display_name: "Claude Code".into(),
            install_command: "npm install -g @anthropic-ai/claude-code".into(),
            detection_command: "which claude".into(),
            config_format: CliConfigFormat::ClaudeSettingsJson,
        },
        CliEntry {
            name: "codex".into(),
            display_name: "Codex".into(),
            install_command: "npm install -g @openai/codex".into(),
            detection_command: "which codex".into(),
            config_format: CliConfigFormat::CodexConfig,
        },
        CliEntry {
            name: "agentii".into(),
            display_name: "Agentii".into(),
            install_command: String::new(), // Pre-installed in base image (post-MVP)
            detection_command: "which agentii".into(),
            config_format: CliConfigFormat::AgentiiConfig,
        },
        CliEntry {
            name: "bash".into(),
            display_name: "Bash".into(),
            install_command: String::new(),
            detection_command: "which bash".into(),
            config_format: CliConfigFormat::None,
        },
        CliEntry {
            name: "zsh".into(),
            display_name: "Zsh".into(),
            install_command: String::new(),
            detection_command: "which zsh".into(),
            config_format: CliConfigFormat::None,
        },
    ]
}
