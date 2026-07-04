use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Permission tier controlling sandbox VM capabilities.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionTier {
    /// Read-only workspace mount, no network access.
    Suggest,
    /// Read-write workspace mount, LLM-only network (allowlisted hosts).
    AutoEdit,
    /// Read-write mount, full network access.
    FullAuto,
}

impl Default for PermissionTier {
    fn default() -> Self {
        Self::AutoEdit
    }
}

/// VM backend engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmBackend {
    Lima,
    OrbStack,
    Firecracker,
    E2b,
}

impl Default for VmBackend {
    fn default() -> Self {
        Self::Lima
    }
}

/// Current status of a VM instance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmStatus {
    /// VM is being created/booted.
    Starting,
    /// VM is running and available.
    Running,
    /// VM is being stopped.
    Stopping,
    /// VM is stopped but can be restarted.
    Stopped,
    /// VM encountered an error.
    Error,
}

/// Configuration for a VM instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmConfig {
    /// Backend engine to use.
    #[serde(default)]
    pub backend: VmBackend,
    /// Permission tier.
    #[serde(default)]
    pub permission_tier: PermissionTier,
    /// RAM allocation in MB (default 1024).
    #[serde(default = "default_ram_mb")]
    pub ram_mb: u32,
    /// CPU cores (default 2).
    #[serde(default = "default_cpus")]
    pub cpus: u32,
    /// Grace period in seconds before stopping VM after last window closes.
    #[serde(default = "default_grace_period")]
    pub grace_period_secs: u64,
    /// LLM host allowlist for AutoEdit tier.
    #[serde(default)]
    pub llm_allowlist: Vec<String>,
    /// Additional environment variables to inject.
    #[serde(default)]
    pub env: HashMap<String, String>,
}

fn default_ram_mb() -> u32 {
    1024
}
fn default_cpus() -> u32 {
    2
}
fn default_grace_period() -> u64 {
    300
}

impl Default for VmConfig {
    fn default() -> Self {
        Self {
            backend: VmBackend::default(),
            permission_tier: PermissionTier::default(),
            ram_mb: default_ram_mb(),
            cpus: default_cpus(),
            grace_period_secs: default_grace_period(),
            llm_allowlist: vec![
                "api.anthropic.com".into(),
                "api.openai.com".into(),
                "api.deepseek.com".into(),
                "generativelanguage.googleapis.com".into(),
            ],
            env: HashMap::new(),
        }
    }
}

/// CLI profile for terminal dropdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliProfile {
    pub name: String,
    pub display_name: String,
    pub installed: bool,
    pub icon: Option<String>,
}
