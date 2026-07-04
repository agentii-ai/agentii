use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tracing::info;

use crate::backend::{VmBackendTrait, VmExecOptions, VmResult};

/// A single MCP tool entry from global or per-project config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolConfig {
    /// Tool name (e.g., "edgartools").
    pub name: String,
    /// Command to run the MCP server.
    pub command: String,
    /// Arguments to the command.
    #[serde(default)]
    pub args: Vec<String>,
    /// Environment variables for the MCP server process.
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Whether this tool is enabled.
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// Global MCP configuration read from ~/.agentii/config/mcp-tools.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalMcpConfig {
    /// Config format version.
    #[serde(default = "default_version")]
    pub version: u32,
    /// MCP tools keyed by name.
    #[serde(default)]
    pub tools: HashMap<String, McpToolConfig>,
    /// Last update timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

fn default_version() -> u32 {
    1
}

impl Default for GlobalMcpConfig {
    fn default() -> Self {
        let mut tools = HashMap::new();
        // C21: No hardcoded EDGAR identity — user must configure via Settings UI.
        tools.insert(
            "edgartools".into(),
            McpToolConfig {
                name: "edgartools".into(),
                command: "python3".into(),
                args: vec!["-m".into(), "edgar.ai".into()],
                env: HashMap::new(),
                enabled: true,
            },
        );
        tools.insert(
            "agentii-financial-mcp".into(),
            McpToolConfig {
                name: "agentii-financial-mcp".into(),
                command: "agentii-financial-mcp-server".into(),
                args: vec![],
                env: HashMap::new(),
                enabled: true,
            },
        );
        Self {
            version: 1,
            tools,
            updated_at: None,
        }
    }
}

/// Inject edgartools-mcp server configuration into CLI-specific config files.
pub struct McpConfigInjector;

impl McpConfigInjector {
    /// Inject MCP config for all supported CLIs inside a VM.
    pub async fn inject_all(
        backend: &dyn VmBackendTrait,
        vm_name: &str,
    ) -> VmResult<()> {
        Self::inject_goose(backend, vm_name).await?;
        Self::inject_opencode(backend, vm_name).await?;
        Self::inject_claude_code(backend, vm_name).await?;
        Ok(())
    }

    /// Inject edgartools-mcp into Goose config.yaml.
    pub async fn inject_goose(
        backend: &dyn VmBackendTrait,
        vm_name: &str,
    ) -> VmResult<()> {
        let script = r#"
mkdir -p ~/.config/goose
cat > /tmp/goose_mcp_patch.py << 'PYEOF'
import yaml
import os

config_path = os.path.expanduser("~/.config/goose/config.yaml")
if os.path.exists(config_path):
    with open(config_path) as f:
        config = yaml.safe_load(f) or {}
else:
    config = {}

if "extensions" not in config:
    config["extensions"] = {}

config["extensions"]["edgartools"] = {
    "type": "stdio",
    "command": "python3",
    "args": ["-m", "edgar.ai"],
    "enabled": True
}

with open(config_path, "w") as f:
    yaml.dump(config, f, default_flow_style=False)
PYEOF
python3 /tmp/goose_mcp_patch.py 2>/dev/null || echo "Goose config injection skipped (pyyaml not available)"
"#;

        backend.exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec!["-c".into(), script.into()],
            env: Default::default(),
            cwd: None,
        }).await?;

        info!("Injected edgartools-mcp into Goose config");
        Ok(())
    }

    /// Inject edgartools-mcp into OpenCode MCP config.
    pub async fn inject_opencode(
        backend: &dyn VmBackendTrait,
        vm_name: &str,
    ) -> VmResult<()> {
        let script = r#"
mkdir -p ~/.config/opencode
cat > /tmp/opencode_mcp_patch.py << 'PYEOF'
import json
import os

config_path = os.path.expanduser("~/.config/opencode/config.json")
if os.path.exists(config_path):
    with open(config_path) as f:
        config = json.load(f)
else:
    config = {}

if "mcpServers" not in config:
    config["mcpServers"] = {}

config["mcpServers"]["edgartools"] = {
    "command": "python3",
    "args": ["-m", "edgar.ai"]
}

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
PYEOF
python3 /tmp/opencode_mcp_patch.py
"#;

        backend.exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec!["-c".into(), script.into()],
            env: Default::default(),
            cwd: None,
        }).await?;

        info!("Injected edgartools-mcp into OpenCode config");
        Ok(())
    }

    /// Inject edgartools-mcp into Claude Code .claude/settings.json.
    pub async fn inject_claude_code(
        backend: &dyn VmBackendTrait,
        vm_name: &str,
    ) -> VmResult<()> {
        let script = r#"
mkdir -p /workspace/.claude
cat > /tmp/claude_mcp_patch.py << 'PYEOF'
import json
import os

config_path = "/workspace/.claude/settings.json"
if os.path.exists(config_path):
    with open(config_path) as f:
        config = json.load(f)
else:
    config = {}

if "mcpServers" not in config:
    config["mcpServers"] = {}

config["mcpServers"]["edgartools"] = {
    "command": "python3",
    "args": ["-m", "edgar.ai"]
}

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
PYEOF
python3 /tmp/claude_mcp_patch.py
"#;

        backend.exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec!["-c".into(), script.into()],
            env: Default::default(),
            cwd: None,
        }).await?;

        info!("Injected edgartools-mcp into Claude Code config");
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// T035: Global + per-project MCP config loading, merging, and persistence
// ---------------------------------------------------------------------------

/// Per-project MCP overrides from .agentii/config.toml [mcp] section.
#[derive(Debug, Clone, Default)]
pub struct ProjectMcpOverrides {
    /// Global tools to disable for this project.
    pub disabled_tools: Vec<String>,
    /// Extra project-specific tools.
    pub extra_tools: HashMap<String, McpToolConfig>,
}

/// Path to global MCP config file (~/.agentii/config/mcp-tools.json).
pub fn global_config_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .expect("HOME or USERPROFILE must be set for MCP config path");
    PathBuf::from(home)
        .join(".agentii")
        .join("config")
        .join("mcp-tools.json")
}

/// Load global MCP config from ~/.agentii/config/mcp-tools.json.
pub async fn load_global_config() -> GlobalMcpConfig {
    let path = global_config_path();
    match tokio::fs::read_to_string(&path).await {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => GlobalMcpConfig::default(),
    }
}

/// Load per-project MCP overrides from `<workspace>/.agentii/config.toml` [mcp] section.
pub async fn load_project_overrides(workspace_path: &Path) -> Option<ProjectMcpOverrides> {
    let config_path = workspace_path.join(".agentii").join("config.toml");
    let content = tokio::fs::read_to_string(&config_path).await.ok()?;
    let parsed: toml::Value = toml::from_str(&content).ok()?;
    let mcp = parsed.get("mcp")?;

    let mut disabled_tools = Vec::new();
    let mut extra_tools = HashMap::new();

    // Check [mcp.tools.<name>] entries
    if let Some(tools) = mcp.get("tools") {
        if let Some(table) = tools.as_table() {
            for (name, val) in table {
                if let Some(tool_table) = val.as_table() {
                    // Tool with enabled = false → disable the global tool
                    if let Some(enabled) = tool_table.get("enabled") {
                        if enabled.as_bool() == Some(false) {
                            disabled_tools.push(name.clone());
                            continue;
                        }
                    }
                    // Otherwise treat as an extra project-specific tool
                    if let Ok(serialized) = toml::to_string(val) {
                        if let Ok(tool) = toml::from_str::<McpToolConfig>(&serialized) {
                            extra_tools.insert(name.clone(), tool);
                        }
                    }
                }
            }
        }
    }

    // Also support top-level [mcp.<name>] with enabled = false
    if let Some(table) = mcp.as_table() {
        for (key, val) in table {
            if key == "tools" {
                continue;
            }
            if let Some(inner) = val.as_table() {
                if let Some(enabled) = inner.get("enabled") {
                    if enabled.as_bool() == Some(false) && !disabled_tools.contains(key) {
                        disabled_tools.push(key.clone());
                    }
                }
            }
        }
    }

    Some(ProjectMcpOverrides {
        disabled_tools,
        extra_tools,
    })
}

/// Merge global config with per-project overrides into a flat tool list.
/// T026: Resolves user config values from config_accessor into env vars.
pub fn merge_configs(
    global: &GlobalMcpConfig,
    overrides: Option<&ProjectMcpOverrides>,
) -> Vec<McpToolConfig> {
    let mut result: Vec<McpToolConfig> = global
        .tools
        .iter()
        .filter(|(_, t)| t.enabled)
        .map(|(id, t)| {
            // Use the HashMap key as the canonical tool ID, not the display name
            let mut tool = t.clone();
            tool.name = id.clone();
            tool
        })
        .collect();

    // T026: Resolve user-configured env vars from registry + config_accessor
    // Load the extended MCP registry to get config schemas (with envMapping)
    let registry_path = crate::extension_registry::mcp_registry_path();
    if let Ok(registry) = crate::extension_registry::load_mcp_registry(&registry_path) {
        for tool in &mut result {
            if let Some(server) = registry.tools.get(&tool.name) {
                // Collect user-configured env vars and merge into tool.env
                let user_env =
                    crate::config_accessor::collect_env_vars("mcp", &tool.name, &server.config);
                for (k, v) in user_env {
                    tool.env.insert(k, v);
                }
            }
        }
    }

    if let Some(ovr) = overrides {
        // Remove disabled tools
        result.retain(|t| !ovr.disabled_tools.contains(&t.name));
        // Add extra project-specific tools
        for (name, tool) in &ovr.extra_tools {
            let mut t = tool.clone();
            t.name = name.clone();
            result.push(t);
        }
    }

    result
}

/// Save global MCP config to ~/.agentii/config/mcp-tools.json.
pub async fn save_global_config(config: &GlobalMcpConfig) -> std::io::Result<()> {
    let path = global_config_path();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    tokio::fs::write(&path, json).await
}
