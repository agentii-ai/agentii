use std::collections::HashMap;

use tracing::{debug, warn};

/// Known LLM provider API key environment variable names.
pub const PROVIDER_KEY_NAMES: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "GOOGLE_API_KEY",
    "GROQ_API_KEY",
    "MISTRAL_API_KEY",
    "OPENROUTER_API_KEY",
];

/// Read API keys from the OS keyring and return as environment variable map.
///
/// Keys are stored under the service name "agentii" with the env var name as username.
/// Keys never touch the VM filesystem — they are passed as env vars at process spawn.
pub fn read_api_keys_from_keyring() -> HashMap<String, String> {
    let mut keys = HashMap::new();

    for key_name in PROVIDER_KEY_NAMES {
        match keyring::Entry::new("agentii", key_name) {
            Ok(entry) => match entry.get_password() {
                Ok(password) if !password.is_empty() => {
                    debug!(key = key_name, "Found API key in keyring");
                    keys.insert(key_name.to_string(), password);
                }
                Ok(_) => {}
                Err(_) => {}
            },
            Err(e) => {
                warn!(key = key_name, error = %e, "Failed to access keyring entry");
            }
        }
    }

    keys
}

/// Store an API key in the OS keyring.
pub fn store_api_key(key_name: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("agentii", key_name)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store key: {e}"))?;
    Ok(())
}

/// Delete an API key from the OS keyring.
pub fn delete_api_key(key_name: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("agentii", key_name)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete key: {e}"))?;
    Ok(())
}

/// Collect all available API keys from keyring + explicit env overrides.
/// Explicit env vars take precedence over keyring.
/// T025: Also collects skill and MCP extension env vars from user config.
pub fn collect_api_keys(extra_env: &HashMap<String, String>) -> HashMap<String, String> {
    let mut keys = read_api_keys_from_keyring();

    // Environment variable overrides
    for key_name in PROVIDER_KEY_NAMES {
        if let Ok(val) = std::env::var(key_name) {
            if !val.is_empty() {
                keys.insert(key_name.to_string(), val);
            }
        }
    }

    // Explicit overrides from config
    for (k, v) in extra_env {
        if !v.is_empty() {
            keys.insert(k.clone(), v.clone());
        }
    }

    // T025: Collect skill extension env vars from registry + user config
    let skill_path = crate::extension_registry::skill_registry_path();
    if let Ok(registry) = crate::extension_registry::load_skill_registry(&skill_path) {
        for cat in &registry.categories {
            for repo in &cat.repos {
                if repo.config.fields.is_empty() {
                    continue;
                }
                let status = crate::config_accessor::derive_config_status(
                    "skill", &repo.id, &repo.config,
                );
                if status == crate::config_accessor::ConfigStatus::Configured
                    || status == crate::config_accessor::ConfigStatus::None
                {
                    let env = crate::config_accessor::collect_env_vars(
                        "skill", &repo.id, &repo.config,
                    );
                    for (k, v) in env {
                        keys.entry(k).or_insert(v);
                    }
                }
            }
        }
    }

    // T025/C10: Collect MCP extension env vars from registry + user config
    let mcp_path = crate::extension_registry::mcp_registry_path();
    if let Ok(registry) = crate::extension_registry::load_mcp_registry(&mcp_path) {
        for (id, server) in &registry.tools {
            if server.config.fields.is_empty() || !server.enabled {
                continue;
            }
            let status = crate::config_accessor::derive_config_status(
                "mcp", id, &server.config,
            );
            if status == crate::config_accessor::ConfigStatus::Configured {
                let env = crate::config_accessor::collect_env_vars(
                    "mcp", id, &server.config,
                );
                for (k, v) in env {
                    keys.entry(k).or_insert(v);
                }
            }
        }
    }

    keys
}

/// Collect API keys and sanitize the full environment for VM injection.
/// Combines keyring keys + explicit env + sanitization.
pub fn collect_and_sanitize_env(extra_env: &HashMap<String, String>) -> HashMap<String, String> {
    let mut raw = collect_api_keys(extra_env);

    // Add standard safe vars from current process
    for var in &["PATH", "HOME", "TERM", "LANG", "USER", "SHELL"] {
        if let Ok(val) = std::env::var(var) {
            raw.entry(var.to_string()).or_insert(val);
        }
    }

    crate::security::env_sanitizer::sanitize_env(&raw)
}

// ---------------------------------------------------------------------------
// Extension secret storage (skills & MCP server credentials)
// ---------------------------------------------------------------------------

/// Store an extension secret in the OS keyring.
/// Service name pattern: `agentii.{entity_type}.{entity_id}.{key}`
pub fn store_extension_secret(
    entity_type: &str,
    entity_id: &str,
    key: &str,
    value: &str,
) -> Result<(), String> {
    let service = format!("agentii.{entity_type}.{entity_id}");
    let entry = keyring::Entry::new(&service, key)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store extension secret: {e}"))?;
    debug!(entity_type, entity_id, key, "Stored extension secret in keyring");
    Ok(())
}

/// Read an extension secret from the OS keyring.
pub fn read_extension_secret(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> Option<String> {
    let service = format!("agentii.{entity_type}.{entity_id}");
    match keyring::Entry::new(&service, key) {
        Ok(entry) => match entry.get_password() {
            Ok(password) if !password.is_empty() => Some(password),
            _ => None,
        },
        Err(_) => None,
    }
}

/// Delete an extension secret from the OS keyring.
pub fn delete_extension_secret(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> Result<(), String> {
    let service = format!("agentii.{entity_type}.{entity_id}");
    let entry = keyring::Entry::new(&service, key)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone
        Err(e) => Err(format!("Failed to delete extension secret: {e}")),
    }
}

/// Check if an extension secret exists in the OS keyring.
pub fn has_extension_secret(
    entity_type: &str,
    entity_id: &str,
    key: &str,
) -> bool {
    read_extension_secret(entity_type, entity_id, key).is_some()
}

// ---------------------------------------------------------------------------
// T011: CliKeyMapper — builds per-CLI env var sets from available keys
// ---------------------------------------------------------------------------

use agentii_protocol::cli_profile::KeyProviderMapping;

/// Provider info resolved from available keys.
#[derive(Debug, Clone)]
pub struct ProviderInfo {
    pub provider_id: String,
    pub model: String,
    pub env_var: String,
}

/// Per-project provider override from .agentii/config.toml [provider] section.
#[derive(Debug, Clone, Default)]
pub struct ProjectOverrides {
    pub provider_name: Option<String>,
    pub provider_model: Option<String>,
}

/// Maps available API keys to CLI-specific environment variable sets.
///
/// For CLI agents: injects all available provider keys + CLI-specific vars.
/// For bash/zsh: returns empty env (FR-012).
pub struct CliKeyMapper {
    keys: HashMap<String, String>,
}

impl CliKeyMapper {
    pub fn new(keys: HashMap<String, String>) -> Self {
        Self { keys }
    }

    /// Create a CliKeyMapper by reading all available API keys from the OS keychain.
    pub async fn from_keychain() -> Self {
        let keys = collect_api_keys(&HashMap::new());
        Self { keys }
    }

    /// Build the environment variable set for a specific CLI agent.
    ///
    /// - For "bash" or "zsh": returns empty HashMap (FR-012).
    /// - For CLI agents: returns all available provider keys + CLI-specific vars
    ///   (e.g., GOOSE_PROVIDER, GOOSE_MODEL for Goose).
    pub fn env_for_cli(&self, cli_id: &str) -> HashMap<String, String> {
        // FR-012: bash/zsh tabs get no API keys
        if cli_id == "bash" || cli_id == "zsh" {
            return HashMap::new();
        }

        // Start with ALL collected keys (provider keys + skill/MCP extension env vars).
        // collect_api_keys() already gathered everything into self.keys.
        let mut env = self.keys.clone();

        // For Goose: add GOOSE_PROVIDER and GOOSE_MODEL based on best available provider
        if cli_id == "goose" {
            if let Some(info) = self.best_provider_for_goose() {
                env.insert("GOOSE_PROVIDER".into(), info.provider_id);
                env.insert("GOOSE_MODEL".into(), info.model);
            }
        }

        env
    }

    /// Build env for CLI with per-project overrides applied.
    pub fn env_for_cli_with_overrides(
        &self,
        cli_id: &str,
        overrides: &ProjectOverrides,
    ) -> HashMap<String, String> {
        let mut env = self.env_for_cli(cli_id);

        // Apply per-project provider override
        if cli_id == "goose" {
            if let Some(ref provider) = overrides.provider_name {
                env.insert("GOOSE_PROVIDER".into(), provider.clone());
                // Find the default model for this provider
                if let Some(ref model) = overrides.provider_model {
                    env.insert("GOOSE_MODEL".into(), model.clone());
                } else if let Some(mapping) = KeyProviderMapping::all_by_priority()
                    .iter()
                    .find(|m| m.goose_provider_id == Some(provider.as_str()))
                {
                    env.insert("GOOSE_MODEL".into(), mapping.default_model.to_string());
                }
            }
        }

        env
    }

    /// Determine the best provider from available keys using priority order.
    ///
    /// Priority: Anthropic > OpenAI > DeepSeek > Google > Groq > Mistral > OpenRouter
    pub fn best_provider_for_goose(&self) -> Option<ProviderInfo> {
        for mapping in KeyProviderMapping::all_by_priority() {
            if self.keys.contains_key(mapping.env_var) {
                if let Some(provider_id) = mapping.goose_provider_id {
                    return Some(ProviderInfo {
                        provider_id: provider_id.to_string(),
                        model: mapping.default_model.to_string(),
                        env_var: mapping.env_var.to_string(),
                    });
                }
            }
        }
        None
    }

    /// Get the list of injected key names (for readiness event reporting).
    pub fn injected_key_names(&self, cli_id: &str) -> Vec<String> {
        self.env_for_cli(cli_id).keys().cloned().collect()
    }
}

// ---------------------------------------------------------------------------
// T012: Per-project provider override reader
// ---------------------------------------------------------------------------

/// Read per-project provider overrides from /workspace/.agentii/config.toml
/// via limactl shell. Returns None if no overrides are configured.
pub async fn read_project_overrides_from_vm(
    backend: &dyn crate::backend::VmBackendTrait,
    vm_name: &str,
) -> Option<ProjectOverrides> {
    let result = backend
        .exec(&crate::backend::VmExecOptions {
            vm_name: vm_name.into(),
            command: "cat".into(),
            args: vec!["/workspace/.agentii/config.toml".into()],
            env: HashMap::new(),
            cwd: None,
        })
        .await
        .ok()?;

    if result.exit_code != 0 || result.stdout.trim().is_empty() {
        return None;
    }

    parse_project_overrides(&result.stdout)
}

/// Parse project overrides from TOML content.
pub fn parse_project_overrides(content: &str) -> Option<ProjectOverrides> {
    let parsed: toml::Value = toml::from_str(content).ok()?;
    let provider = parsed.get("provider")?;

    Some(ProjectOverrides {
        provider_name: provider
            .get("name")
            .and_then(|v| v.as_str())
            .map(String::from),
        provider_model: provider
            .get("model")
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

// ---------------------------------------------------------------------------
// T013: Unit tests for CliKeyMapper
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_keys(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn test_anthropic_only_key() {
        let keys = make_keys(&[("ANTHROPIC_API_KEY", "sk-ant-test")]);
        let mapper = CliKeyMapper::new(keys);
        let env = mapper.env_for_cli("goose");
        assert_eq!(env.get("GOOSE_PROVIDER").map(|s| s.as_str()), Some("anthropic"));
        assert_eq!(env.get("GOOSE_MODEL").map(|s| s.as_str()), Some("claude-sonnet-4"));
    }

    #[test]
    fn test_openai_only_key() {
        let keys = make_keys(&[("OPENAI_API_KEY", "sk-test")]);
        let mapper = CliKeyMapper::new(keys);
        let env = mapper.env_for_cli("goose");
        assert_eq!(env.get("GOOSE_PROVIDER").map(|s| s.as_str()), Some("openai"));
        assert_eq!(env.get("GOOSE_MODEL").map(|s| s.as_str()), Some("gpt-4o"));
    }

    #[test]
    fn test_both_keys_anthropic_priority() {
        let keys = make_keys(&[
            ("ANTHROPIC_API_KEY", "sk-ant-test"),
            ("OPENAI_API_KEY", "sk-test"),
        ]);
        let mapper = CliKeyMapper::new(keys);
        let env = mapper.env_for_cli("goose");
        assert_eq!(env.get("GOOSE_PROVIDER").map(|s| s.as_str()), Some("anthropic"));
        // Both keys should be injected
        assert!(env.contains_key("ANTHROPIC_API_KEY"));
        assert!(env.contains_key("OPENAI_API_KEY"));
    }

    #[test]
    fn test_no_keys_empty_provider() {
        let keys = HashMap::new();
        let mapper = CliKeyMapper::new(keys);
        let env = mapper.env_for_cli("goose");
        assert!(env.get("GOOSE_PROVIDER").is_none());
    }

    #[test]
    fn test_bash_tab_no_keys() {
        let keys = make_keys(&[("ANTHROPIC_API_KEY", "sk-ant-test")]);
        let mapper = CliKeyMapper::new(keys);
        let env = mapper.env_for_cli("bash");
        assert!(env.is_empty(), "Bash tab should get no API keys");
    }

    #[test]
    fn test_per_project_override() {
        let keys = make_keys(&[
            ("ANTHROPIC_API_KEY", "sk-ant-test"),
            ("OPENAI_API_KEY", "sk-test"),
        ]);
        let mapper = CliKeyMapper::new(keys);
        let overrides = ProjectOverrides {
            provider_name: Some("openai".into()),
            provider_model: None,
        };
        let env = mapper.env_for_cli_with_overrides("goose", &overrides);
        assert_eq!(env.get("GOOSE_PROVIDER").map(|s| s.as_str()), Some("openai"));
        assert_eq!(env.get("GOOSE_MODEL").map(|s| s.as_str()), Some("gpt-4o"));
    }

    #[test]
    fn test_parse_project_overrides() {
        let toml_content = r#"
[provider]
name = "openai"
model = "gpt-4o"
"#;
        let overrides = parse_project_overrides(toml_content).unwrap();
        assert_eq!(overrides.provider_name.as_deref(), Some("openai"));
        assert_eq!(overrides.provider_model.as_deref(), Some("gpt-4o"));
    }

    #[test]
    fn test_parse_project_overrides_no_provider() {
        let toml_content = r#"
[mcp]
edgartools.enabled = false
"#;
        let overrides = parse_project_overrides(toml_content);
        assert!(overrides.is_none());
    }
}
