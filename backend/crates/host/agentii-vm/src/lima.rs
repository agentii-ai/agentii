use std::path::PathBuf;
use std::process::Stdio;

use async_trait::async_trait;
use tokio::process::Command;
use tracing::{debug, error, info, warn};

use agentii_protocol::vm::{PermissionTier, VmStatus};

use crate::backend::{BackendCapabilities, VmBackendTrait, VmBootOptions, VmError, VmExecOptions, VmExecOutput, VmResult};
use crate::base_image::BASE_IMAGE_NAME;

/// Lima backend wrapping `limactl` CLI commands.
pub struct LimaBackend {
    /// Path to the Lima VM template YAML.
    pub template_path: PathBuf,
}

impl LimaBackend {
    pub fn new(template_path: PathBuf) -> Self {
        Self { template_path }
    }

    /// Run a limactl command and capture output.
    async fn limactl(&self, args: &[&str]) -> VmResult<VmExecOutput> {
        debug!(args = ?args, "Running limactl");
        let output = Command::new("limactl")
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::ExecFailed(format!("Failed to run limactl: {e}")))?;

        Ok(VmExecOutput {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        })
    }

    /// Apply iptables rules and read-only remount after VM boot/resume.
    async fn apply_post_boot_rules(&self, options: &VmBootOptions) -> VmResult<()> {
        let tier_config = crate::permissions::TierConfig::for_tier(options.permission_tier);
        let rules = tier_config.iptables_rules();
        if !rules.is_empty() {
            let joined = rules.join(" && ");
            info!(vm = %options.vm_name, tier = ?options.permission_tier, rules_count = rules.len(), "Applying iptables rules");
            let result = self.limactl(&[
                "shell", &options.vm_name, "--", "sudo", "bash", "-c", &joined,
            ]).await;
            match result {
                Ok(out) if out.exit_code == 0 => {
                    info!(vm = %options.vm_name, "iptables rules applied successfully");
                }
                Ok(out) => {
                    warn!(vm = %options.vm_name, stderr = %out.stderr, "iptables rules returned non-zero exit");
                }
                Err(e) => {
                    warn!(vm = %options.vm_name, error = %e, "Failed to apply iptables rules");
                }
            }
        }

        // For Suggest tier, remount workspace as read-only
        if tier_config.remount_readonly {
            info!(vm = %options.vm_name, "Remounting workspace as read-only");
            let result = self.limactl(&[
                "shell", &options.vm_name, "--", "sudo", "mount", "-o", "remount,ro", "/workspace/",
            ]).await;
            match result {
                Ok(out) if out.exit_code == 0 => {
                    info!(vm = %options.vm_name, "Workspace remounted read-only");
                }
                Ok(out) => {
                    warn!(vm = %options.vm_name, stderr = %out.stderr, "Read-only remount returned non-zero exit");
                }
                Err(e) => {
                    warn!(vm = %options.vm_name, error = %e, "Failed to remount workspace read-only");
                }
            }
        }

        Ok(())
    }

    /// Generate Lima YAML overrides for a permission tier.
    /// Retained for non-clone boot paths (e.g., future OrbStack backend).
    #[allow(dead_code)]
    fn tier_overrides(&self, tier: PermissionTier) -> Vec<String> {
        match tier {
            PermissionTier::Suggest => {
                vec![
                    "--mount-writable=false".into(),
                    // Network disabled via iptables inside VM
                ]
            }
            PermissionTier::AutoEdit => {
                vec!["--mount-writable=true".into()]
            }
            PermissionTier::FullAuto => {
                vec!["--mount-writable=true".into()]
            }
        }
    }

    /// Create a new VM from the base image with custom mount paths.
    async fn create_vm_from_base_image(
        &self,
        vm_name: &str,
        workspace_path: &std::path::Path,
        persistent_volume_path: Option<&std::path::Path>,
    ) -> VmResult<()> {
        // Base image should exist (created by BaseImageManager)
        let base_yaml_path = format!(
            "{}/.lima/{}/lima.yaml",
            std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()),
            BASE_IMAGE_NAME
        );
        
        let workspace_host_path = workspace_path.display().to_string();
        let persistent_host_path = persistent_volume_path
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "/tmp/agentii-pv".to_string());
        
        // Use limactl start with --set to override mount locations
        // This creates a new VM from the base image configuration
        let result = self.limactl(&[
            "start",
            "--name",
            vm_name,
            "--set",
            &format!(".mounts[0].location=\"{}\"", workspace_host_path),
            "--set", 
            &format!(".mounts[1].location=\"{}\"", persistent_host_path),
            &base_yaml_path,
        ]).await?;

        if result.exit_code != 0 {
            return Err(VmError::BootFailed(format!(
                "VM creation from base image failed: {}",
                result.stderr
            )));
        }
        
        Ok(())
    }

    /// Create a new VM from the base image (alias for create_vm_from_base_image).
    async fn create_vm_from_template(
        &self,
        vm_name: &str,
        workspace_path: &std::path::Path,
        persistent_volume_path: Option<&std::path::Path>,
    ) -> VmResult<()> {
        self.create_vm_from_base_image(vm_name, workspace_path, persistent_volume_path).await
    }
}

#[async_trait]
impl VmBackendTrait for LimaBackend {
    async fn boot(&self, options: &VmBootOptions) -> VmResult<()> {
        let current = self.status(&options.vm_name).await;

        match current {
            Ok(VmStatus::Running) => {
                info!(vm = %options.vm_name, "VM already running");
                return Ok(());
            }
            Ok(VmStatus::Stopped) => {
                // Warm resume — VM exists and is stopped, just start it
                info!(vm = %options.vm_name, "Warm-resuming stopped VM");
                let result = self.limactl(&["start", &options.vm_name]).await?;
                if result.exit_code != 0 {
                    return Err(VmError::BootFailed(result.stderr));
                }
                self.apply_post_boot_rules(options).await?;
                info!(vm = %options.vm_name, "VM warm-resumed successfully");
                return Ok(());
            }
            _ => {}
        }

        // VM doesn't exist — create from template with actual mounts
        info!(vm = %options.vm_name, template = %self.template_path.display(), "Creating VM from template");

        self.create_vm_from_template(
            &options.vm_name,
            &options.workspace_path,
            options.persistent_volume_path.as_deref(),
        ).await?;

        // Start the VM
        let result = self.limactl(&["start", &options.vm_name]).await?;
        if result.exit_code != 0 {
            return Err(VmError::BootFailed(result.stderr));
        }

        // Mounts already configured in template

        self.apply_post_boot_rules(options).await?;

        info!(vm = %options.vm_name, "VM booted successfully from template");
        Ok(())
    }

    async fn stop(&self, vm_name: &str) -> VmResult<()> {
        info!(vm = %vm_name, "Stopping VM");
        let result = self.limactl(&["stop", vm_name]).await?;
        if result.exit_code != 0 {
            return Err(VmError::StopFailed(result.stderr));
        }
        Ok(())
    }

    async fn status(&self, vm_name: &str) -> VmResult<VmStatus> {
        let result = self.limactl(&["list", "--json", vm_name]).await?;
        if result.exit_code != 0 {
            return Err(VmError::NotFound(vm_name.to_string()));
        }

        let stdout = result.stdout.trim();
        if stdout.is_empty() {
            return Err(VmError::NotFound(vm_name.to_string()));
        }

        // Lima JSON output contains a "status" field
        if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(stdout) {
            if let Some(entry) = entries.first() {
                if let Some(status) = entry.get("status").and_then(|s| s.as_str()) {
                    return Ok(match status {
                        "Running" => VmStatus::Running,
                        "Stopped" => VmStatus::Stopped,
                        _ => VmStatus::Error,
                    });
                }
            }
        }

        Err(VmError::NotFound(vm_name.to_string()))
    }

    async fn exec(&self, options: &VmExecOptions) -> VmResult<VmExecOutput> {
        let mut cmd = Command::new("limactl");
        cmd.arg("shell").arg(&options.vm_name);

        // Sanitize environment variables before injection
        let sanitized_env = crate::security::env_sanitizer::sanitize_env(&options.env);
        for (k, v) in &sanitized_env {
            cmd.arg("--").arg(format!("{}={}", k, v));
        }

        cmd.arg("--").arg(&options.command);
        for arg in &options.args {
            cmd.arg(arg);
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let output = cmd
            .output()
            .await
            .map_err(|e| VmError::ExecFailed(format!("limactl shell failed: {e}")))?;

        Ok(VmExecOutput {
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code().unwrap_or(-1),
        })
    }

    async fn mount_workspace(
        &self,
        _vm_name: &str,
        _host_path: &PathBuf,
        _vm_path: &str,
    ) -> VmResult<()> {
        // Lima handles mounts at creation time via --mount flag.
        // Runtime remounting is not needed for the Lima backend.
        Ok(())
    }

    async fn delete(&self, vm_name: &str) -> VmResult<()> {
        info!(vm = %vm_name, "Deleting VM");
        let result = self.limactl(&["delete", "--force", vm_name]).await?;
        if result.exit_code != 0 {
            error!(vm = %vm_name, stderr = %result.stderr, "Failed to delete VM");
        }
        Ok(())
    }

    async fn is_available(&self) -> bool {
        Command::new("limactl")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
    }

    fn name(&self) -> &str {
        "lima"
    }

    async fn clone_base(&self, base_name: &str, new_name: &str) -> VmResult<()> {
        info!(base = %base_name, new = %new_name, "Cloning VM");
        let result = self.limactl(&["clone", base_name, new_name]).await?;
        if result.exit_code != 0 {
            return Err(VmError::BootFailed(format!("Clone failed: {}", result.stderr)));
        }
        Ok(())
    }

    fn capabilities(&self) -> BackendCapabilities {
        BackendCapabilities {
            supports_clone: true,
            supports_snapshot: false,
            supports_virtiofs: true,
            supports_resize: false,
        }
    }
}
