use std::collections::HashMap;
use std::sync::OnceLock;

use crate::credentials;
use crate::extension_registry::{ConfigField, ConfigFieldType, ConfigSchema};
use crate::keys;

/// Compiled regex for detecting unresolved `{PLACEHOLDER}` patterns in env mapping templates.
/// Matches `{word_chars}` — covers both `{API_KEY}` and `{api_key}` style placeholders.
static ENV_PLACEHOLDER_RE: OnceLock<regex::Regex> = OnceLock::new();

fn env_placeholder_regex() -> &'static regex::Regex {
    ENV_PLACEHOLDER_RE.get_or_init(|| {
        regex::Regex::new(r"\{[A-Za-z0-9_-]+\}").expect("Invalid placeholder regex")
    })
}

/// Derived config status for a skill repo or MCP server.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigStatus {
    /// No config fields defined — works out of the box.
    None,
    /// Has required fields that are not yet filled.
    NeedsSetup,
    /// All required fields have values.
    Configured,
}

impl ConfigStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConfigStatus::None => "none",
            ConfigStatus::NeedsSetup => "needs_setup",
            ConfigStatus::Configured => "configured",
        }
    }
}

/// Save a config value, routing secrets to keychain and non-secrets to JSON.
pub fn save_config_value(
    entity_type: &str,
    entity_id: &str,
    field: &ConfigField,
    value: &str,
) -> Result<(), String> {
    if value.is_empty() {
        // Treat empty as "delete"
        return delete_config_value(entity_type, entity_id, field);
    }

    match field.field_type {
        ConfigFieldType::Secret => {
            keys::store_extension_secret(entity_type, entity_id, &field.key, value)?;
            credentials::record_keychain_sentinel(entity_type, entity_id, &field.key)?;
        }
        ConfigFieldType::Text | ConfigFieldType::Select => {
            credentials::save_credential(entity_type, entity_id, &field.key, value)?;
        }
    }
    Ok(())
}

/// Read a config value, resolving secrets from keychain and non-secrets from JSON.
pub fn read_config_value(
    entity_type: &str,
    entity_id: &str,
    field: &ConfigField,
) -> Option<String> {
    match field.field_type {
        ConfigFieldType::Secret => {
            keys::read_extension_secret(entity_type, entity_id, &field.key)
        }
        ConfigFieldType::Text | ConfigFieldType::Select => {
            credentials::read_credential(entity_type, entity_id, &field.key)
        }
    }
}

/// Delete a config value from both keychain and JSON.
fn delete_config_value(
    entity_type: &str,
    entity_id: &str,
    field: &ConfigField,
) -> Result<(), String> {
    match field.field_type {
        ConfigFieldType::Secret => {
            let _ = keys::delete_extension_secret(entity_type, entity_id, &field.key);
            let _ = credentials::delete_credential(entity_type, entity_id, &field.key);
        }
        ConfigFieldType::Text | ConfigFieldType::Select => {
            credentials::delete_credential(entity_type, entity_id, &field.key)?;
        }
    }
    Ok(())
}

/// Check if a config value exists (in keychain or JSON).
pub fn has_value(entity_type: &str, entity_id: &str, key: &str) -> bool {
    // Check keychain first (for secrets)
    if keys::has_extension_secret(entity_type, entity_id, key) {
        return true;
    }
    // Check JSON (for non-secrets or sentinel)
    credentials::has_any_value(entity_type, entity_id, key)
}

/// Derive the config status for a set of config fields.
pub fn derive_config_status(
    entity_type: &str,
    entity_id: &str,
    schema: &ConfigSchema,
) -> ConfigStatus {
    if schema.fields.is_empty() {
        return ConfigStatus::None;
    }

    let all_required_filled = schema
        .fields
        .iter()
        .filter(|f| f.required)
        .all(|f| has_value(entity_type, entity_id, &f.key));

    if all_required_filled {
        ConfigStatus::Configured
    } else {
        ConfigStatus::NeedsSetup
    }
}

/// Collect all configured env vars for an entity (for VM injection).
/// Resolves secrets from keychain, non-secrets from JSON, and applies envMapping templates.
pub fn collect_env_vars(
    entity_type: &str,
    entity_id: &str,
    schema: &ConfigSchema,
) -> HashMap<String, String> {
    let mut env = HashMap::new();

    // Collect raw field values
    let mut raw_values: HashMap<String, String> = HashMap::new();
    for field in &schema.fields {
        if let Some(val) = read_config_value(entity_type, entity_id, field) {
            raw_values.insert(field.key.clone(), val.clone());
            env.insert(field.key.clone(), val);
        }
    }

    // Apply envMapping templates
    if let Some(mapping) = &schema.env_mapping {
        for (target_key, template) in mapping {
            let mut resolved = template.clone();
            for (k, v) in &raw_values {
                resolved = resolved.replace(&format!("{{{k}}}"), v);
            }
            // Only insert if all placeholders were resolved
            if !env_placeholder_regex().is_match(&resolved) {
                env.insert(target_key.clone(), resolved);
            }
        }
    }

    env
}
