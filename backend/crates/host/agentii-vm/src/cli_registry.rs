use std::collections::HashMap;
use std::sync::OnceLock;

use agentii_protocol::cli_profile::{CliAgentProfile, CliEnvVar, CliEnvVarSource};
use agentii_protocol::cli_registry::CliEntry;
use agentii_protocol::vm::CliProfile;
use tracing::debug;

use crate::backend::{VmBackendTrait, VmExecOptions, VmResult};

// ---------------------------------------------------------------------------
// T010: Static CLI_PROFILES registry with full CliAgentProfile entries
// ---------------------------------------------------------------------------

static CLI_PROFILES: OnceLock<Vec<CliAgentProfile>> = OnceLock::new();

fn init_cli_profiles() -> Vec<CliAgentProfile> {
    vec![
        CliAgentProfile {
            id: "goose".into(),
            display_name: "Goose".into(),
            binary_name: "goose".into(),
            launch_command: "goose".into(),
            launch_args: vec![],
            working_dir: "/workspace/".into(),
            required_key_env_vars: vec!["ANTHROPIC_API_KEY".into(), "OPENAI_API_KEY".into()],
            supported_key_env_vars: vec![
                "ANTHROPIC_API_KEY".into(), "OPENAI_API_KEY".into(),
                "DEEPSEEK_API_KEY".into(), "GOOGLE_API_KEY".into(),
                "GROQ_API_KEY".into(), "MISTRAL_API_KEY".into(),
                "OPENROUTER_API_KEY".into(),
            ],
            supports_mcp: true,
            config_file_path: Some("~/.config/goose/config.yaml".into()),
            project_instructions_path: "/workspace/.goosehints".into(),
            skills_dir_path: None,
            install_command: Some("pip3 install goose-ai".into()),
            detection_command: "goose --version".into(),
            default_models: [
                ("anthropic".into(), "claude-sonnet-4".into()),
                ("openai".into(), "gpt-4o".into()),
                ("deepseek".into(), "deepseek-chat".into()),
            ].into_iter().collect(),
            extra_env_vars: vec![
                CliEnvVar { name: "GOOSE_PROVIDER".into(), source: CliEnvVarSource::BestProvider },
                CliEnvVar { name: "GOOSE_MODEL".into(), source: CliEnvVarSource::BestModel },
            ],
        },
        CliAgentProfile {
            id: "claude".into(),
            display_name: "Claude Code".into(),
            binary_name: "claude".into(),
            launch_command: "claude".into(),
            launch_args: vec![],
            working_dir: "/workspace/".into(),
            required_key_env_vars: vec!["ANTHROPIC_API_KEY".into()],
            supported_key_env_vars: vec!["ANTHROPIC_API_KEY".into()],
            supports_mcp: true,
            config_file_path: Some("/workspace/.claude/settings.json".into()),
            project_instructions_path: "/workspace/CLAUDE.md".into(),
            skills_dir_path: Some("~/.claude/skills".into()),
            install_command: Some("npm i -g @anthropic-ai/claude-code".into()),
            detection_command: "claude --version".into(),
            default_models: [
                ("anthropic".into(), "claude-sonnet-4".into()),
            ].into_iter().collect(),
            extra_env_vars: vec![],
        },
        CliAgentProfile {
            id: "opencode".into(),
            display_name: "OpenCode".into(),
            binary_name: "opencode".into(),
            launch_command: "opencode".into(),
            launch_args: vec![],
            working_dir: "/workspace/".into(),
            required_key_env_vars: vec!["ANTHROPIC_API_KEY".into(), "OPENAI_API_KEY".into()],
            supported_key_env_vars: vec![
                "ANTHROPIC_API_KEY".into(), "OPENAI_API_KEY".into(),
                "DEEPSEEK_API_KEY".into(), "GOOGLE_API_KEY".into(),
            ],
            supports_mcp: true,
            config_file_path: Some("~/.config/opencode/config.toml".into()),
            project_instructions_path: "/workspace/.opencode/instructions.md".into(),
            skills_dir_path: Some("~/.config/opencode/skills".into()),
            install_command: Some("go install github.com/opencode-ai/opencode@latest".into()),
            detection_command: "opencode --version".into(),
            default_models: [
                ("anthropic".into(), "claude-sonnet-4".into()),
                ("openai".into(), "gpt-4o".into()),
            ].into_iter().collect(),
            extra_env_vars: vec![],
        },
        CliAgentProfile {
            id: "codex".into(),
            display_name: "Codex".into(),
            binary_name: "codex".into(),
            launch_command: "codex".into(),
            launch_args: vec![],
            working_dir: "/workspace/".into(),
            required_key_env_vars: vec!["OPENAI_API_KEY".into()],
            supported_key_env_vars: vec!["OPENAI_API_KEY".into()],
            supports_mcp: false,
            config_file_path: Some("~/.codex/config.json".into()),
            project_instructions_path: "/workspace/codex.md".into(),
            skills_dir_path: None,
            install_command: Some("npm i -g @openai/codex".into()),
            detection_command: "codex --version".into(),
            default_models: [
                ("openai".into(), "gpt-4o".into()),
            ].into_iter().collect(),
            extra_env_vars: vec![],
        },
        CliAgentProfile {
            id: "bash".into(),
            display_name: "Bash".into(),
            binary_name: "bash".into(),
            launch_command: "bash".into(),
            launch_args: vec!["-l".into()],
            working_dir: "/workspace/".into(),
            required_key_env_vars: vec![],
            supported_key_env_vars: vec![],
            supports_mcp: false,
            config_file_path: None,
            project_instructions_path: String::new(),
            skills_dir_path: None,
            install_command: None,
            detection_command: "which bash".into(),
            default_models: HashMap::new(),
            extra_env_vars: vec![],
        },
    ]
}

/// Get the full CLI agent profile for a given CLI ID.
pub fn get_profile(cli_id: &str) -> Option<&'static CliAgentProfile> {
    CLI_PROFILES.get_or_init(init_cli_profiles).iter().find(|p| p.id == cli_id)
}

/// Get all CLI agent profiles.
pub fn all_profiles() -> &'static [CliAgentProfile] {
    CLI_PROFILES.get_or_init(init_cli_profiles)
}

// ---------------------------------------------------------------------------
// Legacy compatibility: delegate to agentii_protocol::cli_registry
// ---------------------------------------------------------------------------

/// Get the default CLI registry with known agent CLIs (legacy CliEntry format).
pub fn default_registry() -> Vec<CliEntry> {
    agentii_protocol::cli_registry::default_cli_registry()
}

/// Find a CLI entry by name (legacy CliEntry format).
pub fn find_cli(name: &str) -> Option<CliEntry> {
    default_registry().into_iter().find(|c| c.name == name)
}

/// Detect which CLIs from the default registry are installed inside a VM.
pub async fn detect_all(
    backend: &dyn VmBackendTrait,
    vm_name: &str,
) -> VmResult<Vec<CliProfile>> {
    let registry = default_registry();
    let mut result = Vec::new();

    for entry in &registry {
        if entry.detection_command.is_empty() {
            result.push(CliProfile {
                name: entry.name.clone(),
                display_name: entry.display_name.clone(),
                installed: true,
                icon: None,
            });
            continue;
        }

        let output = backend
            .exec(&VmExecOptions {
                vm_name: vm_name.into(),
                command: "sh".into(),
                args: vec!["-c".into(), entry.detection_command.clone()],
                env: HashMap::new(),
                cwd: None,
            })
            .await;

        let installed = output.map(|o| o.exit_code == 0).unwrap_or(false);
        debug!(cli = %entry.name, installed, "CLI detection result");

        result.push(CliProfile {
            name: entry.name.clone(),
            display_name: entry.display_name.clone(),
            installed,
            icon: None,
        });
    }

    Ok(result)
}
