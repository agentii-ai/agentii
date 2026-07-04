use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{info, warn};

use agentii_vm::config_accessor;
use agentii_vm::credentials;
use agentii_vm::extension_registry::{self, ConfigFieldType};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureSkillRequest {
    pub repo_id: String,
    pub values: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureMcpRequest {
    pub server_id: String,
    pub values: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleSkillRequest {
    pub repo_id: String,
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleMcpRequest {
    pub server_id: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureResponse {
    pub ok: bool,
    pub config_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Build the JSON array for config fields, merging `hasValue` from config_accessor.
fn build_config_fields_json(
    entity_type: &str,
    entity_id: &str,
    fields: &[agentii_vm::extension_registry::ConfigField],
) -> Vec<Value> {
    fields
        .iter()
        .map(|f| {
            serde_json::json!({
                "key": f.key,
                "label": f.label,
                "type": match f.field_type {
                    ConfigFieldType::Secret => "secret",
                    ConfigFieldType::Text => "text",
                    ConfigFieldType::Select => "select",
                },
                "required": f.required,
                "placeholder": f.placeholder,
                "helpUrl": f.help_url,
                "options": f.options,
                "hasValue": config_accessor::has_value(entity_type, entity_id, &f.key),
            })
        })
        .collect()
}

/// Persist toggle state to credentials.json under a `__enabled` key.
fn persist_toggle(entity_type: &str, entity_id: &str, enabled: bool) {
    let key = "__enabled";
    let value = if enabled { "true" } else { "false" };
    if let Err(e) = credentials::save_credential(entity_type, entity_id, key, value) {
        warn!(entity_type, entity_id, error = %e, "Failed to persist toggle state");
    }
}

/// Read persisted toggle state. Returns None if never explicitly toggled.
fn read_toggle(entity_type: &str, entity_id: &str) -> Option<bool> {
    credentials::read_credential(entity_type, entity_id, "__enabled")
        .map(|v| v == "true")
}

/// Derive the effective enabled state:
/// 1. If user explicitly toggled, use that.
/// 2. Otherwise, derive from config status (no-config = enabled, configured = enabled, needs_setup = disabled).
fn effective_enabled(entity_type: &str, entity_id: &str, status: &config_accessor::ConfigStatus) -> bool {
    if let Some(explicit) = read_toggle(entity_type, entity_id) {
        return explicit;
    }
    matches!(status, config_accessor::ConfigStatus::None | config_accessor::ConfigStatus::Configured)
}

// ---------------------------------------------------------------------------
// Handler: settings.skills.list
// ---------------------------------------------------------------------------

pub async fn handle_skills_list(_body: &[u8]) -> (u16, Vec<u8>) {
    info!("RPC: settings.skills.list");

    let path = extension_registry::skill_registry_path();
    let registry = match extension_registry::load_skill_registry(&path) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to load skill registry");
            let err = serde_json::json!({ "error": format!("Failed to load registry: {e}") });
            return (500, serde_json::to_vec(&err).unwrap());
        }
    };

    let mut categories = Vec::new();
    for cat in &registry.categories {
        let mut repos = Vec::new();
        for repo in &cat.repos {
            let status = config_accessor::derive_config_status("skill", &repo.id, &repo.config);
            let enabled = effective_enabled("skill", &repo.id, &status);
            let fields = build_config_fields_json("skill", &repo.id, &repo.config.fields);

            let skills: Vec<Value> = repo
                .skills
                .iter()
                .map(|s| {
                    serde_json::json!({
                        "id": s.id,
                        "name": s.name,
                        "path": s.path,
                        "requiresConfig": s.requires_config,
                    })
                })
                .collect();

            repos.push(serde_json::json!({
                "id": repo.id,
                "name": repo.name,
                "author": repo.author,
                "repoUrl": repo.repo_url,
                "description": repo.description,
                "enabled": enabled,
                "configStatus": status.as_str(),
                "configFields": fields,
                "skills": skills,
            }));
        }
        categories.push(serde_json::json!({
            "id": cat.id,
            "label": cat.label,
            "repos": repos,
        }));
    }

    let response = serde_json::json!({ "categories": categories });
    (200, serde_json::to_vec(&response).unwrap())
}

// ---------------------------------------------------------------------------
// Handler: settings.skills.configure
// ---------------------------------------------------------------------------

pub async fn handle_skills_configure(body: &[u8]) -> (u16, Vec<u8>) {
    info!("RPC: settings.skills.configure");

    let req: ConfigureSkillRequest = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let resp = ConfigureResponse {
                ok: false,
                config_status: "unknown".into(),
                error: Some("invalid_request".into()),
                message: Some(format!("Failed to parse request: {e}")),
                warning: None,
            };
            return (400, serde_json::to_vec(&resp).unwrap());
        }
    };

    let path = extension_registry::skill_registry_path();
    let registry = match extension_registry::load_skill_registry(&path) {
        Ok(r) => r,
        Err(e) => {
            let resp = ConfigureResponse {
                ok: false,
                config_status: "unknown".into(),
                error: Some("registry_error".into()),
                message: Some(format!("Failed to load registry: {e}")),
                warning: None,
            };
            return (500, serde_json::to_vec(&resp).unwrap());
        }
    };

    let repo = registry
        .categories
        .iter()
        .flat_map(|c| &c.repos)
        .find(|r| r.id == req.repo_id);

    let repo = match repo {
        Some(r) => r,
        None => {
            let resp = ConfigureResponse {
                ok: false,
                config_status: "unknown".into(),
                error: Some("unknown_repo".into()),
                message: Some(format!("Repo '{}' not found in registry", req.repo_id)),
                warning: None,
            };
            return (404, serde_json::to_vec(&resp).unwrap());
        }
    };

    // Save each value; warn on unknown keys (C28)
    let mut ignored_keys = Vec::new();
    for (key, value) in &req.values {
        if let Some(field) = repo.config.fields.iter().find(|f| f.key == *key) {
            if let Err(e) = config_accessor::save_config_value("skill", &req.repo_id, field, value)
            {
                let resp = ConfigureResponse {
                    ok: false,
                    config_status: "unknown".into(),
                    error: Some("save_error".into()),
                    message: Some(format!("Failed to save {key}: {e}")),
                    warning: None,
                };
                return (500, serde_json::to_vec(&resp).unwrap());
            }
        } else {
            warn!(repo_id = %req.repo_id, key = %key, "Ignoring unknown config key");
            ignored_keys.push(key.clone());
        }
    }

    let status = config_accessor::derive_config_status("skill", &req.repo_id, &repo.config);
    let warning = if ignored_keys.is_empty() {
        None
    } else {
        Some(format!("Ignored unknown keys: {}", ignored_keys.join(", ")))
    };
    let resp = ConfigureResponse {
        ok: true,
        config_status: status.as_str().into(),
        error: None,
        message: None,
        warning,
    };
    (200, serde_json::to_vec(&resp).unwrap())
}

// ---------------------------------------------------------------------------
// Handler: settings.skills.toggle
// ---------------------------------------------------------------------------

pub async fn handle_skills_toggle(body: &[u8]) -> (u16, Vec<u8>) {
    info!("RPC: settings.skills.toggle");

    let req: ToggleSkillRequest = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let resp = ToggleResponse {
                ok: false,
                warning: Some(format!("Failed to parse request: {e}")),
            };
            return (400, serde_json::to_vec(&resp).unwrap());
        }
    };

    info!(repo_id = %req.repo_id, enabled = req.enabled, "Skill toggle");

    // C5: Persist toggle state
    persist_toggle("skill", &req.repo_id, req.enabled);

    // Check if config is complete when enabling
    let warning = if req.enabled {
        let path = extension_registry::skill_registry_path();
        extension_registry::load_skill_registry(&path)
            .ok()
            .and_then(|registry| {
                registry
                    .categories
                    .iter()
                    .flat_map(|c| &c.repos)
                    .find(|r| r.id == req.repo_id)
                    .and_then(|repo| {
                        let status = config_accessor::derive_config_status("skill", &req.repo_id, &repo.config);
                        if status == config_accessor::ConfigStatus::NeedsSetup {
                            Some("Required configuration is incomplete. Skills may not function.".into())
                        } else {
                            None
                        }
                    })
            })
    } else {
        None
    };

    let resp = ToggleResponse { ok: true, warning };
    (200, serde_json::to_vec(&resp).unwrap())
}

// ---------------------------------------------------------------------------
// Handler: settings.mcp.list
// ---------------------------------------------------------------------------

pub async fn handle_mcp_list(_body: &[u8]) -> (u16, Vec<u8>) {
    info!("RPC: settings.mcp.list");

    let path = extension_registry::mcp_registry_path();
    let registry = match extension_registry::load_mcp_registry(&path) {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "Failed to load MCP registry");
            let err = serde_json::json!({ "error": format!("Failed to load MCP registry: {e}") });
            return (500, serde_json::to_vec(&err).unwrap());
        }
    };

    let mut servers = Vec::new();
    for (id, server) in &registry.tools {
        let status = config_accessor::derive_config_status("mcp", id, &server.config);
        let enabled = effective_enabled("mcp", id, &status);
        let fields = build_config_fields_json("mcp", id, &server.config.fields);

        servers.push(serde_json::json!({
            "id": id,
            "name": server.name,
            "description": server.description,
            "transport": server.transport,
            "enabled": enabled,
            "configStatus": status.as_str(),
            "compatibility": server.compatibility,
            "configFields": fields,
        }));
    }

    let response = serde_json::json!({ "servers": servers });
    (200, serde_json::to_vec(&response).unwrap())
}

// ---------------------------------------------------------------------------
// Handler: settings.mcp.configure
// ---------------------------------------------------------------------------

pub async fn handle_mcp_configure(body: &[u8]) -> (u16, Vec<u8>) {
    info!("RPC: settings.mcp.configure");

    let req: ConfigureMcpRequest = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let resp = ConfigureResponse {
                ok: false,
                config_status: "unknown".into(),
                error: Some("invalid_request".into()),
                message: Some(format!("Failed to parse request: {e}")),
                warning: None,
            };
            return (400, serde_json::to_vec(&resp).unwrap());
        }
    };

    let path = extension_registry::mcp_registry_path();
    let registry = match extension_registry::load_mcp_registry(&path) {
        Ok(r) => r,
        Err(e) => {
            let resp = ConfigureResponse {
                ok: false,
                config_status: "unknown".into(),
                error: Some("registry_error".into()),
                message: Some(format!("Failed to load MCP registry: {e}")),
                warning: None,
            };
            return (500, serde_json::to_vec(&resp).unwrap());
        }
    };

    let server = match registry.tools.get(&req.server_id) {
        Some(s) => s,
        None => {
            let resp = ConfigureResponse {
                ok: false,
                config_status: "unknown".into(),
                error: Some("unknown_server".into()),
                message: Some(format!("Server '{}' not found in registry", req.server_id)),
                warning: None,
            };
            return (404, serde_json::to_vec(&resp).unwrap());
        }
    };

    let mut ignored_keys = Vec::new();
    for (key, value) in &req.values {
        if let Some(field) = server.config.fields.iter().find(|f| f.key == *key) {
            if let Err(e) =
                config_accessor::save_config_value("mcp", &req.server_id, field, value)
            {
                let resp = ConfigureResponse {
                    ok: false,
                    config_status: "unknown".into(),
                    error: Some("save_error".into()),
                    message: Some(format!("Failed to save {key}: {e}")),
                    warning: None,
                };
                return (500, serde_json::to_vec(&resp).unwrap());
            }
        } else {
            warn!(server_id = %req.server_id, key = %key, "Ignoring unknown config key");
            ignored_keys.push(key.clone());
        }
    }

    let status = config_accessor::derive_config_status("mcp", &req.server_id, &server.config);
    let warning = if ignored_keys.is_empty() {
        None
    } else {
        Some(format!("Ignored unknown keys: {}", ignored_keys.join(", ")))
    };
    let resp = ConfigureResponse {
        ok: true,
        config_status: status.as_str().into(),
        error: None,
        message: None,
        warning,
    };
    (200, serde_json::to_vec(&resp).unwrap())
}

// ---------------------------------------------------------------------------
// Handler: settings.mcp.toggle
// ---------------------------------------------------------------------------

pub async fn handle_mcp_toggle(body: &[u8]) -> (u16, Vec<u8>) {
    info!("RPC: settings.mcp.toggle");

    let req: ToggleMcpRequest = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let resp = ToggleResponse {
                ok: false,
                warning: Some(format!("Failed to parse request: {e}")),
            };
            return (400, serde_json::to_vec(&resp).unwrap());
        }
    };

    info!(server_id = %req.server_id, enabled = req.enabled, "MCP toggle");

    // C6: Persist toggle state
    persist_toggle("mcp", &req.server_id, req.enabled);

    // Check if config is complete when enabling
    let warning = if req.enabled {
        let path = extension_registry::mcp_registry_path();
        extension_registry::load_mcp_registry(&path)
            .ok()
            .and_then(|registry| {
                registry.tools.get(&req.server_id).and_then(|server| {
                    let status = config_accessor::derive_config_status("mcp", &req.server_id, &server.config);
                    if status == config_accessor::ConfigStatus::NeedsSetup {
                        Some("Required configuration is incomplete. Server may not function.".into())
                    } else {
                        None
                    }
                })
            })
    } else {
        None
    };

    let resp = ToggleResponse { ok: true, warning };
    (200, serde_json::to_vec(&resp).unwrap())
}
