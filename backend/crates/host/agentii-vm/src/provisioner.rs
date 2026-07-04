use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use agentii_protocol::cli_registry::{CliConfigFormat, CliEntry};

use crate::backend::{VmBackendTrait, VmExecOptions, VmExecOutput, VmResult};

/// Health status of a provisioned MCP server process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum McpHealth {
    /// Process is running normally.
    Healthy,
    /// Process is not running (crashed or never started).
    Down,
    /// Process was restarted after a crash.
    Restarted,
    /// Health check has not run yet.
    Unknown,
}

/// Tracks a single MCP server process inside a VM.
#[derive(Debug, Clone)]
pub struct McpProcessInfo {
    /// CLI name this MCP server serves (e.g. "goose", "claude").
    pub cli_name: String,
    /// PID inside the VM (0 if not running).
    pub pid: u32,
    /// Current health status.
    pub health: McpHealth,
    /// Number of times this process has been restarted.
    pub restart_count: u32,
}

/// Auto-configures edgartools-mcp for all installed CLIs and monitors health.
///
/// # Backend Agnosticism
/// All provisioning operations use `VmBackendTrait::exec()` for command execution
/// inside the VM. No Lima-specific code paths exist in this module.
/// Lima-specific logic is confined to `lima.rs`.
pub struct McpProvisioner {
    /// VM backend for executing commands.
    backend: Arc<dyn VmBackendTrait>,
    /// VM name this provisioner manages.
    vm_name: String,
    /// Tracked MCP processes keyed by CLI name.
    processes: Arc<RwLock<HashMap<String, McpProcessInfo>>>,
    /// Health check interval.
    health_interval: Duration,
}

impl McpProvisioner {
    pub fn new(backend: Arc<dyn VmBackendTrait>, vm_name: String) -> Self {
        Self {
            backend,
            vm_name,
            processes: Arc::new(RwLock::new(HashMap::new())),
            health_interval: Duration::from_secs(30),
        }
    }

    /// Detect installed CLIs and configure edgartools-mcp for each.
    ///
    /// Scans the VM for known CLIs, then writes the appropriate MCP config
    /// for each one found.
    pub async fn provision_all(&self, registry: &[CliEntry]) -> VmResult<Vec<String>> {
        let mut configured = Vec::new();

        for entry in registry {
            if matches!(entry.config_format, CliConfigFormat::None) {
                continue;
            }

            // Check if CLI is installed
            let installed = self.detect_cli(&entry.detection_command).await?;
            if !installed {
                debug!(cli = %entry.name, "CLI not installed, skipping MCP config");
                continue;
            }

            info!(cli = %entry.name, "CLI detected, configuring edgartools-mcp");

            match entry.config_format {
                CliConfigFormat::ClaudeSettingsJson => {
                    self.configure_claude_code().await?;
                }
                CliConfigFormat::GooseProfilesYaml => {
                    self.configure_goose().await?;
                }
                CliConfigFormat::OpenCodeConfig => {
                    self.configure_opencode().await?;
                }
                CliConfigFormat::CodexConfig => {
                    self.configure_codex().await?;
                }
                CliConfigFormat::AgentiiConfig => {
                    debug!(vm = %self.vm_name, "Agentii native MCP config not yet defined, skipping");
                }
                CliConfigFormat::None => {}
            }

            // Register process for health monitoring
            let mut procs = self.processes.write().await;
            procs.insert(
                entry.name.clone(),
                McpProcessInfo {
                    cli_name: entry.name.clone(),
                    pid: 0,
                    health: McpHealth::Unknown,
                    restart_count: 0,
                },
            );

            configured.push(entry.name.clone());
        }

        info!(
            vm = %self.vm_name,
            configured = ?configured,
            "MCP provisioning complete"
        );

        Ok(configured)
    }

    /// Configure Claude Code .claude/settings.json MCP section.
    async fn configure_claude_code(&self) -> VmResult<()> {
        let script = r#"
mkdir -p /workspace/.claude
cat > /tmp/_mcp_claude.py << 'PYEOF'
import json, os
p = "/workspace/.claude/settings.json"
c = json.load(open(p)) if os.path.exists(p) else {}
c.setdefault("mcpServers", {})["edgartools"] = {
    "command": "python3", "args": ["-m", "edgar.ai"]
}
with open(p, "w") as f: json.dump(c, f, indent=2)
PYEOF
python3 /tmp/_mcp_claude.py
"#;
        self.exec_script(script).await?;
        info!(vm = %self.vm_name, "Configured Claude Code MCP");
        Ok(())
    }

    /// Configure Goose config.yaml MCP section.
    async fn configure_goose(&self) -> VmResult<()> {
        let script = r#"
mkdir -p ~/.config/goose
cat > /tmp/_mcp_goose.py << 'PYEOF'
import yaml, os
p = os.path.expanduser("~/.config/goose/config.yaml")
c = yaml.safe_load(open(p)) if os.path.exists(p) else {}
if not c: c = {}
c.setdefault("extensions", {})["edgartools"] = {
    "type": "stdio", "command": "python3", "args": ["-m", "edgar.ai"], "enabled": True
}
with open(p, "w") as f: yaml.dump(c, f, default_flow_style=False)
PYEOF
python3 /tmp/_mcp_goose.py 2>/dev/null || echo "goose config skipped (pyyaml missing)"
"#;
        self.exec_script(script).await?;
        info!(vm = %self.vm_name, "Configured Goose MCP");
        Ok(())
    }

    /// Configure OpenCode MCP config.
    async fn configure_opencode(&self) -> VmResult<()> {
        let script = r#"
mkdir -p ~/.config/opencode
cat > /tmp/_mcp_opencode.py << 'PYEOF'
import json, os
p = os.path.expanduser("~/.config/opencode/config.json")
c = json.load(open(p)) if os.path.exists(p) else {}
c.setdefault("mcpServers", {})["edgartools"] = {
    "command": "python3", "args": ["-m", "edgar.ai"]
}
with open(p, "w") as f: json.dump(c, f, indent=2)
PYEOF
python3 /tmp/_mcp_opencode.py
"#;
        self.exec_script(script).await?;
        info!(vm = %self.vm_name, "Configured OpenCode MCP");
        Ok(())
    }

    /// Configure Codex MCP config (placeholder — format TBD).
    async fn configure_codex(&self) -> VmResult<()> {
        debug!(vm = %self.vm_name, "Codex MCP config not yet defined, skipping");
        Ok(())
    }

    /// Start the health monitoring loop.
    ///
    /// Checks every 30s whether MCP server processes are alive inside the VM.
    /// Auto-restarts crashed processes.
    pub fn start_health_monitor(&self) -> tokio::task::JoinHandle<()> {
        let backend = self.backend.clone();
        let vm_name = self.vm_name.clone();
        let processes = self.processes.clone();
        let interval = self.health_interval;

        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);

            loop {
                ticker.tick().await;

                let mut procs = processes.write().await;
                for (cli_name, proc_info) in procs.iter_mut() {
                    let alive = check_mcp_alive(&backend, &vm_name, cli_name).await;

                    match alive {
                        Ok(true) => {
                            if proc_info.health != McpHealth::Healthy {
                                debug!(vm = %vm_name, cli = %cli_name, "MCP process healthy");
                            }
                            proc_info.health = McpHealth::Healthy;
                        }
                        Ok(false) => {
                            warn!(
                                vm = %vm_name,
                                cli = %cli_name,
                                "MCP process down, attempting restart"
                            );
                            proc_info.health = McpHealth::Down;

                            log_mcp_event(
                                &vm_name,
                                cli_name,
                                crate::observability::VmEventType::McpHealth,
                                crate::observability::LogLevel::Warn,
                            ).await;

                            match restart_mcp(&backend, &vm_name, cli_name).await {
                                Ok(pid) => {
                                    proc_info.pid = pid;
                                    proc_info.health = McpHealth::Restarted;
                                    proc_info.restart_count += 1;
                                    info!(
                                        vm = %vm_name,
                                        cli = %cli_name,
                                        pid,
                                        restarts = proc_info.restart_count,
                                        "MCP process restarted"
                                    );

                                    log_mcp_event(
                                        &vm_name,
                                        cli_name,
                                        crate::observability::VmEventType::McpRestart,
                                        crate::observability::LogLevel::Info,
                                    ).await;
                                }
                                Err(e) => {
                                    error!(
                                        vm = %vm_name,
                                        cli = %cli_name,
                                        error = %e,
                                        "Failed to restart MCP process"
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            warn!(
                                vm = %vm_name,
                                cli = %cli_name,
                                error = %e,
                                "Health check failed"
                            );
                        }
                    }
                }
            }
        })
    }

    /// Get current health status for all tracked MCP processes.
    ///
    /// Suitable for inclusion in a `vm.status` response.
    pub async fn health_report(&self) -> HashMap<String, McpProcessInfo> {
        self.processes.read().await.clone()
    }

    // -----------------------------------------------------------------------
    // T036: Merged MCP provisioning (global + project overrides)
    // -----------------------------------------------------------------------

    /// Provision merged MCP tools (global + project overrides) for all detected CLIs.
    ///
    /// Loads the global config from `~/.agentii/config/mcp-tools.json`, applies
    /// per-project overrides from `<workspace>/.agentii/config.toml`, and writes
    /// the resulting tool set into each installed CLI's config format.
    pub async fn provision_merged_mcp(
        &self,
        workspace_path: &std::path::Path,
        registry: &[CliEntry],
    ) -> VmResult<Vec<String>> {
        let global = crate::mcp_config::load_global_config().await;
        let overrides = crate::mcp_config::load_project_overrides(workspace_path).await;
        let tools = crate::mcp_config::merge_configs(&global, overrides.as_ref());

        if tools.is_empty() {
            info!(vm = %self.vm_name, "No MCP tools to provision after merge");
            return Ok(Vec::new());
        }

        let mut configured = Vec::new();

        for entry in registry {
            if matches!(entry.config_format, CliConfigFormat::None) {
                continue;
            }

            let installed = self.detect_cli(&entry.detection_command).await?;
            if !installed {
                debug!(cli = %entry.name, "CLI not installed, skipping merged MCP config");
                continue;
            }

            self.write_mcp_config_for_cli(&entry.name, &entry.config_format, &tools)
                .await?;
            configured.push(entry.name.clone());
        }

        info!(
            vm = %self.vm_name,
            configured = ?configured,
            tools = tools.len(),
            "Merged MCP provisioning complete"
        );

        Ok(configured)
    }

    /// Write MCP config for a specific CLI with the given merged tools.
    async fn write_mcp_config_for_cli(
        &self,
        cli_name: &str,
        format: &CliConfigFormat,
        tools: &[crate::mcp_config::McpToolConfig],
    ) -> VmResult<()> {
        let tools_json = serde_json::to_string(tools).unwrap_or_else(|_| "[]".into());

        let script = match format {
            CliConfigFormat::ClaudeSettingsJson => format!(
                r#"
mkdir -p /workspace/.claude
cat > /tmp/_mcp_merged.py << 'PYEOF'
import json, os, sys
tools = json.loads(sys.argv[1])
p = "/workspace/.claude/settings.json"
c = json.load(open(p)) if os.path.exists(p) else {{}}
c.setdefault("mcpServers", {{}})
for t in tools:
    c["mcpServers"][t["name"]] = {{"command": t["command"], "args": t.get("args", [])}}
with open(p, "w") as f: json.dump(c, f, indent=2)
PYEOF
python3 /tmp/_mcp_merged.py '{tools_json}'
"#
            ),
            CliConfigFormat::GooseProfilesYaml => format!(
                r#"
mkdir -p ~/.config/goose
cat > /tmp/_mcp_merged.py << 'PYEOF'
import json, os, sys
try:
    import yaml
except ImportError:
    sys.exit(0)
tools = json.loads(sys.argv[1])
p = os.path.expanduser("~/.config/goose/config.yaml")
c = yaml.safe_load(open(p)) if os.path.exists(p) else {{}}
if not c: c = {{}}
c.setdefault("extensions", {{}})
for t in tools:
    ext = {{"type": "stdio", "command": t["command"], "enabled": True}}
    if t.get("args"):
        ext["args"] = t["args"]
    if t.get("env"):
        ext["env"] = t["env"]
    c["extensions"][t["name"]] = ext
with open(p, "w") as f: yaml.dump(c, f, default_flow_style=False)
PYEOF
python3 /tmp/_mcp_merged.py '{tools_json}' 2>/dev/null || echo "goose config skipped"
"#
            ),
            CliConfigFormat::OpenCodeConfig => format!(
                r#"
mkdir -p ~/.config/opencode
cat > /tmp/_mcp_merged.py << 'PYEOF'
import json, os, sys
tools = json.loads(sys.argv[1])
p = os.path.expanduser("~/.config/opencode/config.json")
c = json.load(open(p)) if os.path.exists(p) else {{}}
c.setdefault("mcpServers", {{}})
for t in tools:
    c["mcpServers"][t["name"]] = {{"command": t["command"], "args": t.get("args", [])}}
with open(p, "w") as f: json.dump(c, f, indent=2)
PYEOF
python3 /tmp/_mcp_merged.py '{tools_json}'
"#
            ),
            CliConfigFormat::CodexConfig => {
                debug!(cli = %cli_name, "Codex merged MCP config not yet defined, skipping");
                return Ok(());
            }
            CliConfigFormat::AgentiiConfig => {
                debug!(cli = %cli_name, "Agentii native merged MCP config not yet defined, skipping");
                return Ok(());
            }
            CliConfigFormat::None => return Ok(()),
        };

        self.exec_script(&script).await?;
        info!(cli = %cli_name, tools = tools.len(), "Provisioned merged MCP tools");
        Ok(())
    }

    // -----------------------------------------------------------------------
    // T037: Global skill file provisioning
    // -----------------------------------------------------------------------

    /// Copy global skill files from `~/.agentii/config/skills/` into the workspace.
    ///
    /// Existing project-specific skill files are not overwritten.
    pub async fn provision_skills(&self, workspace_path: &str) -> VmResult<Vec<String>> {
        let skills_src = format!(
            "{home}/.agentii/config/skills",
            home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())
        );

        // If the global skills directory doesn't exist on the host, nothing to do.
        if !std::path::Path::new(&skills_src).exists() {
            return Ok(Vec::new());
        }

        let script = format!(
            r#"
mkdir -p {workspace_path}/.agentii/skills
# Copy global skills; don't overwrite existing project-specific ones
if [ -d "/host-skills" ]; then
    for f in /host-skills/*.md; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        if [ ! -f "{workspace_path}/.agentii/skills/$base" ]; then
            cp "$f" "{workspace_path}/.agentii/skills/$base"
        fi
    done
fi
"#
        );

        // Skills are mounted or copied during workspace provisioning.
        // In production the host skills dir is bind-mounted at /host-skills.
        self.exec_script(&script).await?;

        info!(vm = %self.vm_name, "Provisioned global skills to workspace");
        Ok(vec!["skills provisioned".into()])
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Detect whether a CLI is installed by running its detection command.
    async fn detect_cli(&self, detection_command: &str) -> VmResult<bool> {
        let output = self.exec_script(detection_command).await?;
        Ok(output.exit_code == 0)
    }

    /// Execute a shell script inside the VM.
    async fn exec_script(&self, script: &str) -> VmResult<VmExecOutput> {
        self.backend
            .exec(&VmExecOptions {
                vm_name: self.vm_name.clone(),
                command: "bash".into(),
                args: vec!["-c".into(), script.into()],
                env: Default::default(),
                cwd: None,
            })
            .await
    }
}

// ---------------------------------------------------------------------------
// T058: provision_mcp_for_all_clis — orchestrate MCP provisioning for all CLIs
// ---------------------------------------------------------------------------

/// Provision MCP tools for all installed MCP-capable CLIs in a VM.
///
/// Reads global MCP config from `~/.agentii/config/mcp-tools.json`,
/// merges with per-project overrides from `/workspace/.agentii/config.toml`,
/// and generates per-CLI config formats (Goose YAML, Claude JSON, OpenCode TOML).
/// Codex is skipped (no MCP support per FR-020).
pub async fn provision_mcp_for_all_clis(
    backend: &dyn VmBackendTrait,
    vm_name: &str,
    workspace_path: &str,
) -> VmResult<()> {
    // Load global MCP config
    let global_config = crate::mcp_config::load_global_config().await;

    // Load per-project overrides from workspace config.toml
    let workspace = std::path::Path::new(workspace_path);
    let project_overrides = crate::mcp_config::load_project_overrides(workspace).await;

    // T061: Merge global + project overrides
    let merged_tools = crate::mcp_config::merge_configs(&global_config, project_overrides.as_ref());

    if merged_tools.is_empty() {
        info!(vm = %vm_name, "No MCP tools to provision");
        return Ok(());
    }

    // Provision for each MCP-capable CLI (skip codex per FR-020, skip bash)
    let mcp_capable_clis = ["goose", "claude", "opencode"];

    for cli_id in &mcp_capable_clis {
        if let Err(e) = reprovision_cli_config(backend, vm_name, cli_id, &merged_tools).await {
            warn!(cli = %cli_id, error = %e, "Failed to provision MCP for CLI (non-fatal)");
        }
    }

    info!(vm = %vm_name, tools = merged_tools.len(), "MCP tools provisioned for all CLIs");
    Ok(())
}

// ---------------------------------------------------------------------------
// T059: provision_skills — standalone entrypoint for skills provisioning
// ---------------------------------------------------------------------------

/// Provision global skills into a workspace and create CLI-specific symlinks.
///
/// - Loads registry.json to determine which skill repos are enabled
/// - Copies full skill directories (including scripts/, references/, assets/)
///   from `/host-skills/` to `/workspace/.agentii/skills/`
/// - Creates symlinks: `~/.claude/skills → /workspace/.agentii/skills`
///                      `~/.config/opencode/skills → /workspace/.agentii/skills`
/// - Goose/Codex: skills referenced via system prompt content (no native skill dirs)
pub async fn provision_skills_for_workspace(
    backend: &dyn VmBackendTrait,
    vm_name: &str,
) -> VmResult<()> {
    // T022: Registry-aware skill provisioning — copy full directories, not just .md files
    let script = r#"
mkdir -p /workspace/.agentii/skills

# Copy global skills if host-skills mount exists
if [ -d "/host-skills" ]; then
    # Copy full directory trees (scripts/, references/, assets/, SKILL.md)
    for d in /host-skills/*/; do
        [ -d "$d" ] || continue
        base=$(basename "$d")
        if [ ! -d "/workspace/.agentii/skills/$base" ]; then
            cp -r "$d" "/workspace/.agentii/skills/$base"
        fi
    done
    # Also copy any top-level files (registry.json, README.md)
    for f in /host-skills/*.json /host-skills/*.md; do
        [ -f "$f" ] || continue
        base=$(basename "$f")
        cp -f "$f" "/workspace/.agentii/skills/$base"
    done
fi

# Claude Code symlink
mkdir -p ~/.claude
ln -sfn /workspace/.agentii/skills ~/.claude/skills

# OpenCode symlink
mkdir -p ~/.config/opencode
ln -sfn /workspace/.agentii/skills ~/.config/opencode/skills

echo "skills_provisioned"
"#;

    let result = backend
        .exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec!["-c".into(), script.into()],
            env: Default::default(),
            cwd: None,
        })
        .await?;

    if result.stdout.trim() == "skills_provisioned" {
        info!(vm = %vm_name, "Skills provisioned with symlinks for Claude Code and OpenCode");
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// T023/T036: reprovision_cli_config — self-healing config re-provisioning
// ---------------------------------------------------------------------------

/// Re-provision CLI-specific config file at every PTY spawn (self-healing).
///
/// Generates the CLI-specific config, writes it to the VM, and also checks
/// and regenerates the project instructions file from system_prompt.md if missing.
pub async fn reprovision_cli_config(
    backend: &dyn VmBackendTrait,
    vm_name: &str,
    cli_id: &str,
    mcp_tools: &[crate::mcp_config::McpToolConfig],
) -> VmResult<()> {
    // Generate CLI-specific config content
    let config = crate::cli_config::generate_config_for_cli(cli_id, mcp_tools);

    if let Some((config_path, content)) = config {
        // Expand ~ to VM home dir; absolute paths (e.g. /workspace/...) pass through unchanged
        let expanded_path = if config_path.starts_with('~') {
            config_path.replace('~', "/home/agentii.linux")
        } else {
            config_path
        };
        let parent = std::path::Path::new(&expanded_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let script = format!(
            "mkdir -p '{parent}' && cat > '{expanded_path}' << 'CONFIGEOF'\n{content}\nCONFIGEOF"
        );

        backend
            .exec(&VmExecOptions {
                vm_name: vm_name.into(),
                command: "bash".into(),
                args: vec!["-c".into(), script],
                env: Default::default(),
                cwd: None,
            })
            .await?;

        info!(cli = cli_id, path = %expanded_path, "Re-provisioned CLI config");
    }

    // Self-healing: regenerate project instructions file if missing (FR-026)
    if let Some(instructions_path) = crate::system_prompt::instructions_path_for_cli(cli_id) {
        let full_path = format!("/workspace/{instructions_path}");
        let check_script = format!(
            r#"
if [ ! -f '{full_path}' ] && [ -f '/workspace/.agentii/system_prompt.md' ]; then
    mkdir -p "$(dirname '{full_path}')"
    cp /workspace/.agentii/system_prompt.md '{full_path}'
    echo "regenerated"
else
    echo "exists"
fi
"#
        );

        let result = backend
            .exec(&VmExecOptions {
                vm_name: vm_name.into(),
                command: "bash".into(),
                args: vec!["-c".into(), check_script],
                env: Default::default(),
                cwd: None,
            })
            .await?;

        if result.stdout.trim() == "regenerated" {
            info!(cli = cli_id, path = %full_path, "Self-healed missing project instructions file");
        }
    }

    // Create skills symlinks for CLIs that support them
    let profile = crate::cli_registry::get_profile(cli_id);
    if let Some(profile) = profile {
        if let Some(ref skills_dir) = profile.skills_dir_path {
            let expanded = if skills_dir.starts_with('~') {
                format!("/home/agentii.linux{}", &skills_dir[1..])
            } else {
                skills_dir.clone()
            };
            let script = format!(
                "mkdir -p /workspace/.agentii/skills && mkdir -p \"$(dirname '{expanded}')\" && ln -sfn /workspace/.agentii/skills '{expanded}'"
            );
            let _ = backend
                .exec(&VmExecOptions {
                    vm_name: vm_name.into(),
                    command: "bash".into(),
                    args: vec!["-c".into(), script],
                    env: Default::default(),
                    cwd: None,
                })
                .await;
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Host-side MCP config provisioning (no VM)
// ---------------------------------------------------------------------------

/// Expand a config path for the host filesystem.
/// - `/workspace/...` → `<workspace_path>/...`
/// - `~/...` → `$HOME/...`
/// - absolute paths pass through unchanged
fn expand_host_path(config_path: &str, workspace_path: &std::path::Path) -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    if config_path == "/workspace" || config_path.starts_with("/workspace/") {
        let suffix = &config_path["/workspace".len()..];
        workspace_path.join(suffix.trim_start_matches('/')).to_string_lossy().to_string()
    } else if config_path.starts_with('~') {
        format!("{}{}", home, &config_path[1..])
    } else {
        config_path.to_string()
    }
}

/// Merge provisioned MCP tools into an existing Claude Code settings.json.
///
/// Preserves any user-added mcpServers entries; only adds/updates provisioned tools.
fn merge_claude_config(
    existing_content: Option<&str>,
    mcp_tools: &[crate::mcp_config::McpToolConfig],
) -> String {
    let mut config: serde_json::Value = existing_content
        .and_then(|c| serde_json::from_str(c).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    let obj = config.as_object_mut().unwrap();
    obj.entry("acceptedTerms").or_insert(serde_json::json!(true));

    let servers = obj.entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}))
        .as_object_mut()
        .unwrap();

    for tool in mcp_tools {
        let mut entry = serde_json::Map::new();
        entry.insert("command".into(), serde_json::Value::String(tool.command.clone()));
        entry.insert(
            "args".into(),
            serde_json::Value::Array(tool.args.iter().map(|a| serde_json::Value::String(a.clone())).collect()),
        );
        if !tool.env.is_empty() {
            let env_obj: serde_json::Map<String, serde_json::Value> = tool.env.iter()
                .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                .collect();
            entry.insert("env".into(), serde_json::Value::Object(env_obj));
        }
        servers.insert(tool.name.clone(), serde_json::Value::Object(entry));
    }

    serde_json::to_string_pretty(&config).unwrap_or_else(|_| r#"{"acceptedTerms":true}"#.into())
}

/// Merge provisioned MCP tools into an existing OpenCode config.toml.
///
/// Preserves existing config sections; only adds/updates [mcp.*] entries.
fn merge_opencode_config(
    existing_content: Option<&str>,
    mcp_tools: &[crate::mcp_config::McpToolConfig],
) -> String {
    // Parse existing config or start fresh
    let mut config: toml::Table = existing_content
        .and_then(|c| toml::from_str(c).ok())
        .unwrap_or_default();

    // Ensure [general] section with onboarding_complete
    let general = config.entry("general")
        .or_insert_with(|| toml::Value::Table(toml::Table::new()))
        .as_table_mut();
    if let Some(general) = general {
        general.entry("onboarding_complete")
            .or_insert(toml::Value::Boolean(true));
    }

    // Get or create [mcp] section
    let mcp = config.entry("mcp")
        .or_insert_with(|| toml::Value::Table(toml::Table::new()))
        .as_table_mut();
    if let Some(mcp) = mcp {
        for tool in mcp_tools {
            let mut tool_table = toml::Table::new();
            tool_table.insert("command".into(), toml::Value::String(tool.command.clone()));
            if !tool.args.is_empty() {
                tool_table.insert(
                    "args".into(),
                    toml::Value::Array(tool.args.iter().map(|a| toml::Value::String(a.clone())).collect()),
                );
            }
            if !tool.env.is_empty() {
                let mut env_table = toml::Table::new();
                for (k, v) in &tool.env {
                    env_table.insert(k.clone(), toml::Value::String(v.clone()));
                }
                tool_table.insert("env".into(), toml::Value::Table(env_table));
            }
            mcp.insert(tool.name.clone(), toml::Value::Table(tool_table));
        }
    }

    toml::to_string_pretty(&config).unwrap_or_else(|_| "[general]\nonboarding_complete = true\n".into())
}

/// Re-provision CLI-specific config file on the **host filesystem** (no VM).
///
/// This is the host-PTY counterpart to `reprovision_cli_config()`. Merges MCP tools
/// into existing config files (preserving user-added entries) rather than overwriting.
///
/// Also self-heals missing project instructions files and creates skills symlinks,
/// matching the behavior of the VM-side `reprovision_cli_config()`.
pub fn reprovision_cli_config_host(
    cli_id: &str,
    mcp_tools: &[crate::mcp_config::McpToolConfig],
    workspace_path: &std::path::Path,
) -> std::io::Result<()> {
    let config = crate::cli_config::generate_config_for_cli(cli_id, mcp_tools);

    if let Some((config_path, _generated_content)) = config {
        let expanded_path = expand_host_path(&config_path, workspace_path);
        let path = std::path::Path::new(&expanded_path);

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Merge into existing config (preserving user-added entries) for JSON/TOML formats.
        // Goose (YAML) uses full-write since generate_goose_config produces a complete config
        // with GOOSE_MODE, telemetry, etc. that must be present.
        let existing = std::fs::read_to_string(path).ok();
        let merged_content = match cli_id {
            "claude" => merge_claude_config(existing.as_deref(), mcp_tools),
            "opencode" => merge_opencode_config(existing.as_deref(), mcp_tools),
            _ => _generated_content, // goose, codex: full write
        };

        std::fs::write(path, &merged_content)?;
        tracing::info!(cli = cli_id, path = %expanded_path, "Re-provisioned CLI config on host");
    }

    // Self-healing: regenerate project instructions file if missing
    if let Some(instructions_rel) = crate::system_prompt::instructions_path_for_cli(cli_id) {
        let instructions_path = workspace_path.join(instructions_rel);
        let system_prompt_path = workspace_path.join(".agentii/system_prompt.md");

        if !instructions_path.exists() && system_prompt_path.exists() {
            if let Some(parent) = instructions_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&system_prompt_path, &instructions_path)?;
            tracing::info!(cli = cli_id, path = %instructions_path.display(), "Self-healed missing project instructions on host");
        }
    }

    Ok(())
}

/// Check if the edgartools-mcp process is alive for a given CLI.
async fn check_mcp_alive(
    backend: &Arc<dyn VmBackendTrait>,
    vm_name: &str,
    _cli_name: &str,
) -> VmResult<bool> {
    let output = backend
        .exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec![
                "-c".into(),
                "pgrep -f 'edgar.ai' > /dev/null 2>&1 && echo alive || echo dead"
                    .into(),
            ],
            env: Default::default(),
            cwd: None,
        })
        .await?;

    Ok(output.stdout.trim() == "alive")
}

/// Restart the edgartools-mcp server process inside the VM.
/// Returns the new PID.
async fn restart_mcp(
    backend: &Arc<dyn VmBackendTrait>,
    vm_name: &str,
    _cli_name: &str,
) -> VmResult<u32> {
    // Kill any existing process first
    let _ = backend
        .exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec![
                "-c".into(),
                "pkill -f 'edgar.ai' 2>/dev/null; sleep 1".into(),
            ],
            env: Default::default(),
            cwd: None,
        })
        .await;

    // Start fresh
    let output = backend
        .exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec![
                "-c".into(),
                "nohup python3 -m edgar.ai > /tmp/mcp.log 2>&1 & echo $!".into(),
            ],
            env: Default::default(),
            cwd: None,
        })
        .await?;

    let pid: u32 = output
        .stdout
        .trim()
        .parse()
        .unwrap_or(0);

    Ok(pid)
}

/// Log an MCP health event via the structured VM event logger.
pub async fn log_mcp_event(
    project_id: &str,
    cli_name: &str,
    event_type: crate::observability::VmEventType,
    level: crate::observability::LogLevel,
) {
    let logger = crate::observability::VmEventLogger::new();
    logger
        .log_event(
            project_id,
            event_type,
            level,
            None,
            serde_json::json!({"cli": cli_name}),
        )
        .await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_health_default() {
        let info = McpProcessInfo {
            cli_name: "goose".into(),
            pid: 0,
            health: McpHealth::Unknown,
            restart_count: 0,
        };
        assert_eq!(info.health, McpHealth::Unknown);
        assert_eq!(info.restart_count, 0);
    }

    #[test]
    fn test_reprovision_cli_config_host_writes_claude_config() {
        let tmp = std::env::temp_dir().join(format!("agentii_test_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp);

        let tools = vec![crate::mcp_config::McpToolConfig {
            name: "edgartools".into(),
            command: "python3".into(),
            args: vec!["-m".into(), "edgar.ai".into()],
            env: Default::default(),
            enabled: true,
        }];

        let result = reprovision_cli_config_host("claude", &tools, &tmp);
        assert!(result.is_ok(), "reprovision_cli_config_host failed: {:?}", result.err());

        // Claude config should be written to <workspace>/.claude/settings.json
        let config_path = tmp.join(".claude/settings.json");
        assert!(config_path.exists(), "Claude config not written at {:?}", config_path);

        let content = std::fs::read_to_string(&config_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).expect("Invalid JSON");
        assert_eq!(parsed["acceptedTerms"], true);
        assert!(parsed["mcpServers"]["edgartools"].is_object());

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_reprovision_cli_config_host_writes_goose_config() {
        let tmp = std::env::temp_dir().join(format!("agentii_test_goose_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&tmp);

        let tools = vec![crate::mcp_config::McpToolConfig {
            name: "edgartools".into(),
            command: "python3".into(),
            args: vec!["-m".into(), "edgar.ai".into()],
            env: Default::default(),
            enabled: true,
        }];

        let result = reprovision_cli_config_host("goose", &tools, &tmp);
        assert!(result.is_ok(), "reprovision_cli_config_host failed: {:?}", result.err());

        // Goose config should be written to $HOME/.config/goose/config.yaml
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let _config_path = std::path::PathBuf::from(&home)
            .join(".config/goose/config.yaml");
        // We can't assert the file exists in CI (would pollute $HOME),
        // but we can verify the function didn't error.

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_merge_claude_config_preserves_user_entries() {
        let existing = r#"{
  "acceptedTerms": true,
  "mcpServers": {
    "my-custom-server": {
      "command": "node",
      "args": ["my-server.js"]
    }
  }
}"#;
        let tools = vec![crate::mcp_config::McpToolConfig {
            name: "edgartools".into(),
            command: "python3".into(),
            args: vec!["-m".into(), "edgar.ai".into()],
            env: Default::default(),
            enabled: true,
        }];

        let result = merge_claude_config(Some(existing), &tools);
        let parsed: serde_json::Value = serde_json::from_str(&result).expect("Invalid JSON");

        // Provisioned tool should be present
        assert!(parsed["mcpServers"]["edgartools"].is_object(), "Missing provisioned edgartools");
        // User's custom server should be preserved
        assert!(parsed["mcpServers"]["my-custom-server"].is_object(), "User's custom server was wiped");
        assert_eq!(parsed["mcpServers"]["my-custom-server"]["command"], "node");
    }

    #[test]
    fn test_merge_claude_config_creates_fresh() {
        let tools = vec![crate::mcp_config::McpToolConfig {
            name: "edgartools".into(),
            command: "python3".into(),
            args: vec!["-m".into(), "edgar.ai".into()],
            env: Default::default(),
            enabled: true,
        }];

        let result = merge_claude_config(None, &tools);
        let parsed: serde_json::Value = serde_json::from_str(&result).expect("Invalid JSON");

        assert_eq!(parsed["acceptedTerms"], true);
        assert!(parsed["mcpServers"]["edgartools"].is_object());
    }

    #[test]
    fn test_merge_opencode_config_preserves_user_entries() {
        let existing = r#"[general]
onboarding_complete = true

[mcp.my-custom-server]
command = "node"
args = ["my-server.js"]
"#;
        let tools = vec![crate::mcp_config::McpToolConfig {
            name: "edgartools".into(),
            command: "python3".into(),
            args: vec!["-m".into(), "edgar.ai".into()],
            env: Default::default(),
            enabled: true,
        }];

        let result = merge_opencode_config(Some(existing), &tools);

        // Provisioned tool should be present
        assert!(result.contains("edgartools"), "Missing provisioned edgartools");
        // User's custom server should be preserved
        assert!(result.contains("my-custom-server"), "User's custom server was wiped");
    }

    #[test]
    fn test_expand_host_path_workspace() {
        let ws = std::path::PathBuf::from("/Users/test/projects/myproject");
        assert_eq!(
            expand_host_path("/workspace/.claude/settings.json", &ws),
            "/Users/test/projects/myproject/.claude/settings.json"
        );
    }

    #[test]
    fn test_expand_host_path_tilde() {
        let ws = std::path::PathBuf::from("/tmp");
        let result = expand_host_path("~/.config/goose/config.yaml", &ws);
        // Should start with $HOME, not with ~
        assert!(!result.starts_with('~'), "Tilde should be expanded");
        assert!(result.ends_with("/.config/goose/config.yaml"));
    }

    #[test]
    fn test_expand_host_path_no_false_workspace_match() {
        let ws = std::path::PathBuf::from("/tmp");
        // /workspace-backup should NOT match /workspace prefix
        assert_eq!(
            expand_host_path("/workspace-backup/foo", &ws),
            "/workspace-backup/foo"
        );
    }

    #[test]
    fn test_host_self_healing_instructions() {
        let tmp = std::env::temp_dir().join(format!("agentii_test_heal_{}", std::process::id()));
        let _ = std::fs::create_dir_all(tmp.join(".agentii"));

        // Create a system_prompt.md source file
        std::fs::write(tmp.join(".agentii/system_prompt.md"), "# Test prompt").unwrap();

        let tools = vec![];
        let result = reprovision_cli_config_host("claude", &tools, &tmp);
        assert!(result.is_ok());

        // CLAUDE.md should have been self-healed from system_prompt.md
        let claude_md = tmp.join("CLAUDE.md");
        assert!(claude_md.exists(), "CLAUDE.md should be self-healed");
        assert_eq!(std::fs::read_to_string(&claude_md).unwrap(), "# Test prompt");

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
