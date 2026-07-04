use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// Config types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfigFieldType {
    Secret,
    Text,
    Select,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigField {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: ConfigFieldType,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub help_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_value: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSchema {
    pub fields: Vec<ConfigField>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_mapping: Option<HashMap<String, String>>,
}

// Skill types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub requires_config: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRepo {
    pub id: String,
    pub name: String,
    pub author: String,
    pub repo_url: String,
    pub description: String,
    pub config: ConfigSchema,
    pub skills: Vec<SkillEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCategory {
    pub id: String,
    pub label: String,
    pub repos: Vec<SkillRepo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRegistry {
    pub version: u32,
    pub categories: Vec<SkillCategory>,
}

// MCP types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerExtended {
    pub name: String,
    pub description: String,
    pub command: String,
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub enabled: bool,
    pub transport: String,
    pub compatibility: Vec<String>,
    pub config: ConfigSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpRegistry {
    pub version: u32,
    pub tools: HashMap<String, McpServerExtended>,
}

// Load functions
pub fn load_skill_registry(path: &Path) -> anyhow::Result<SkillRegistry> {
    let content = std::fs::read_to_string(path)?;
    let registry: SkillRegistry = serde_json::from_str(&content)?;
    Ok(registry)
}

pub fn load_mcp_registry(path: &Path) -> anyhow::Result<McpRegistry> {
    let content = std::fs::read_to_string(path)?;
    let registry: McpRegistry = serde_json::from_str(&content)?;
    Ok(registry)
}

fn home_dir() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .expect("HOME or USERPROFILE must be set for registry path resolution")
}

/// Resolve the MCP registry path — checks repo-local first, then home dir.
pub fn mcp_registry_path() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut dir = cwd.as_path();
    loop {
        let candidate = dir.join(".agentii/config/mcp-tools.json");
        if candidate.exists() {
            return candidate;
        }
        match dir.parent() {
            Some(parent) => dir = parent,
            None => break,
        }
    }
    home_dir().join(".agentii/config/mcp-tools.json")
}

/// Resolve the skill registry path — walks up from cwd, falls back to home dir.
pub fn skill_registry_path() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_default();
    let mut dir = cwd.as_path();
    loop {
        let candidate = dir.join(".agentii/skills/registry.json");
        if candidate.exists() {
            return candidate;
        }
        match dir.parent() {
            Some(parent) => dir = parent,
            None => break,
        }
    }
    home_dir().join(".agentii/skills/registry.json")
}
