use std::collections::HashMap;

use tracing::{info, warn};

use crate::backend::{VmBackendTrait, VmExecOptions, VmResult};
use crate::cli_registry;
use agentii_protocol::vm::CliProfile;

/// Detect which CLIs are installed inside a VM.
pub async fn detect_installed_clis(
    backend: &dyn VmBackendTrait,
    vm_name: &str,
) -> VmResult<Vec<CliProfile>> {
    let registry = cli_registry::default_registry();
    let mut profiles = Vec::new();

    for entry in &registry {
        if entry.detection_command.is_empty() {
            profiles.push(CliProfile {
                name: entry.name.clone(),
                display_name: entry.display_name.clone(),
                installed: true,
                icon: None,
            });
            continue;
        }

        let result = backend
            .exec(&VmExecOptions {
                vm_name: vm_name.into(),
                command: "sh".into(),
                args: vec!["-c".into(), entry.detection_command.clone()],
                env: HashMap::new(),
                cwd: None,
            })
            .await;

        let installed = match result {
            Ok(output) => output.exit_code == 0,
            Err(_) => false,
        };

        profiles.push(CliProfile {
            name: entry.name.clone(),
            display_name: entry.display_name.clone(),
            installed,
            icon: None,
        });
    }

    Ok(profiles)
}

/// Install a CLI inside a VM by name. The install result is cached in the persistent layer.
pub async fn install_cli(
    backend: &dyn VmBackendTrait,
    vm_name: &str,
    cli_name: &str,
) -> VmResult<()> {
    let entry = cli_registry::find_cli(cli_name);
    let entry = match entry {
        Some(e) => e,
        None => {
            return Err(crate::backend::VmError::ExecFailed(format!(
                "Unknown CLI: {cli_name}"
            )));
        }
    };

    if entry.install_command.is_empty() {
        info!(cli = cli_name, "CLI is pre-installed, nothing to do");
        return Ok(());
    }

    // Use CLI-specific install commands with dependency checks where needed.
    let install_cmd = resolve_install_command(cli_name, &entry.install_command);

    info!(cli = cli_name, command = %install_cmd, "Installing CLI in VM");

    let result = backend
        .exec(&VmExecOptions {
            vm_name: vm_name.into(),
            command: "bash".into(),
            args: vec!["-c".into(), install_cmd],
            env: HashMap::new(),
            cwd: None,
        })
        .await?;

    if result.exit_code != 0 {
        warn!(
            cli = cli_name,
            stderr = %result.stderr,
            "CLI installation failed"
        );
        return Err(crate::backend::VmError::ExecFailed(format!(
            "Failed to install {cli_name}: {}",
            result.stderr
        )));
    }

    info!(cli = cli_name, "CLI installed successfully");
    Ok(())
}

/// Resolve the install command for a CLI, adding dependency checks where needed.
///
/// Some CLIs require specific runtimes (e.g. Go for opencode). This function
/// wraps the base install command with a prerequisite check so failures are
/// graceful rather than cryptic.
///
/// T044: Updated fallback table with entries for claude, opencode, codex.
fn resolve_install_command(cli_name: &str, default_cmd: &str) -> String {
    match cli_name {
        "opencode" => {
            // OpenCode requires Go -- check availability first
            format!(
                "command -v go >/dev/null 2>&1 && (GOPATH=/usr/local/share/go {default_cmd} && ln -sf /usr/local/share/go/bin/opencode /usr/local/bin/opencode) || echo 'Go not installed, skipping opencode'"
            )
        }
        "goose" => {
            // Prefer pipx, fall back to pip3 with --break-system-packages
            format!(
                "command -v pipx >/dev/null 2>&1 && ({default_cmd}) || pip3 install goose-ai --break-system-packages"
            )
        }
        "claude" => {
            // Claude Code via npm
            format!(
                "command -v npm >/dev/null 2>&1 && (npm install -g @anthropic-ai/claude-code) || echo 'npm not installed, skipping claude'"
            )
        }
        "codex" => {
            // Codex via npm
            format!(
                "command -v npm >/dev/null 2>&1 && (npm install -g @openai/codex) || echo 'npm not installed, skipping codex'"
            )
        }
        _ => default_cmd.to_string(),
    }
}
