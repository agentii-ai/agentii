//! Base image management — golden image lifecycle, versioning, and cloning.
//! Implements the agent-vm pattern: create once, clone per-project (copy-on-write).

use std::path::PathBuf;
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::{fs, process::Command};
use tracing::info;

use crate::backend::VmError;

/// Current bundled base image version.
pub const BUNDLED_BASE_VERSION: &str = "1.0.0";

/// Default base image Lima instance name.
pub const BASE_IMAGE_NAME: &str = "agentii-base";

/// Tracks the golden base image state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseImageInfo {
    /// Semantic version (e.g., "1.0.0").
    pub version: String,
    /// Lima instance name.
    pub lima_name: String,
    /// Whether the base image exists and is ready for cloning.
    pub ready: bool,
    /// Disk size of the base image in bytes.
    pub disk_size_bytes: u64,
    /// Pre-installed runtimes and tools.
    pub installed: Vec<String>,
    /// Creation timestamp (ISO 8601).
    pub created_at: String,
}

/// Manages the golden base image lifecycle.
pub struct BaseImageManager {
    /// Path to the Lima YAML template.
    template_path: PathBuf,
}

impl BaseImageManager {
    pub fn new(template_path: PathBuf) -> Self {
        Self { template_path }
    }

    /// Default manager using the bundled template.
    pub fn default_with_template() -> Self {
        let template = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("templates")
            .join("agentii-base.yaml");
        Self::new(template)
    }

    /// Ensure the base image exists and is ready for cloning.
    /// Creates it from template if it doesn't exist.
    pub async fn ensure_base_image(&self) -> Result<BaseImageInfo, VmError> {
        // Check if base image already exists
        let output = Command::new("limactl")
            .args(["list", "--json", BASE_IMAGE_NAME])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::ExecFailed(format!("Failed to run limactl list: {e}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout);

        // Parse JSON to check if base exists
        if output.status.success() && !stdout.trim().is_empty() {
            // Try to parse as array first (list with no filter), then as single object (list with name filter)
            let exists = match serde_json::from_str::<serde_json::Value>(stdout.trim()) {
                Ok(serde_json::Value::Array(arr)) => {
                    arr.iter().any(|entry| {
                        entry.get("name")
                            .and_then(|n| n.as_str())
                            .map(|n| n == BASE_IMAGE_NAME)
                            .unwrap_or(false)
                    })
                }
                Ok(serde_json::Value::Object(obj)) => {
                    obj.get("name")
                        .and_then(|n| n.as_str())
                        .map(|n| n == BASE_IMAGE_NAME)
                        .unwrap_or(false)
                }
                _ => false,
            };
            if exists {
                info!(name = BASE_IMAGE_NAME, "Base image already exists");
                return Ok(self.read_base_info().await);
            }
        }

        // Base image doesn't exist — create it
        info!(name = BASE_IMAGE_NAME, template = %self.template_path.display(), "Creating base image");

        // Render template with dummy paths for base image
        let rendered = self.render_template_for_base_image().await.map_err(|e| {
            VmError::BootFailed(format!("Failed to render base image template: {e}"))
        })?;

        // Write to temporary file
        let temp_dir = std::env::temp_dir();
        let temp_file_path = temp_dir.join(format!("agentii-base-{}.yaml", BASE_IMAGE_NAME));
        fs::write(&temp_file_path, &rendered).await.map_err(|e| {
            VmError::BootFailed(format!("Failed to write temporary YAML: {e}"))
        })?;

        let result = Command::new("limactl")
            .args([
                "create",
                "--name",
                BASE_IMAGE_NAME,
                &temp_file_path.to_string_lossy(),
                "--tty=false",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::BootFailed(format!("Failed to create base image: {e}")))?;

        // Clean up temporary file
        let _ = fs::remove_file(&temp_file_path).await;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(VmError::BootFailed(format!(
                "Base image creation failed: {stderr}"
            )));
        }

        // Start the base image to run provisioning
        let result = Command::new("limactl")
            .args(["start", BASE_IMAGE_NAME])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::BootFailed(format!("Failed to start base image: {e}")))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(VmError::BootFailed(format!(
                "Base image start failed: {stderr}"
            )));
        }

        // Stop the base image (ready for cloning)
        let _ = Command::new("limactl")
            .args(["stop", BASE_IMAGE_NAME])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        // Write version file
        self.write_version(BUNDLED_BASE_VERSION).await;

        info!(name = BASE_IMAGE_NAME, version = BUNDLED_BASE_VERSION, "Base image created and ready for cloning");

        // T042: Validate all CLIs are installed
        // Start the image temporarily for validation
        let _ = Command::new("limactl")
            .args(["start", BASE_IMAGE_NAME])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;
        let cli_results = self.validate_base_image().await;
        let all_ok = cli_results.iter().all(|(_, ok)| *ok);
        if !all_ok {
            let missing: Vec<_> = cli_results.iter().filter(|(_, ok)| !ok).map(|(n, _)| n.as_str()).collect();
            tracing::warn!(missing = ?missing, "Some CLIs missing from base image");
        }
        let _ = Command::new("limactl")
            .args(["stop", BASE_IMAGE_NAME])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        // T043: Validate disk size
        let _ = self.validate_disk_size().await;

        let logger = crate::observability::VmEventLogger::new();
        logger.log_event(
            "system",
            crate::observability::VmEventType::BaseImageCreate,
            crate::observability::LogLevel::Info,
            None,
            serde_json::json!({"version": BUNDLED_BASE_VERSION}),
        ).await;

        Ok(self.read_base_info().await)
    }

    /// Clone the base image for a specific project.
    /// Returns the new VM name.
    pub async fn clone_for_project(&self, project_id: &str) -> Result<String, VmError> {
        let vm_name = project_vm_name(project_id);

        // Check if clone already exists
        let output = Command::new("limactl")
            .args(["list", "--json", &vm_name])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::ExecFailed(format!("Failed to check VM existence: {e}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        if output.status.success() && !stdout.trim().is_empty() {
            if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(stdout.trim()) {
                if !entries.is_empty() {
                    info!(vm = %vm_name, "VM clone already exists");
                    return Ok(vm_name);
                }
            }
        }

        // Clone from base
        info!(base = BASE_IMAGE_NAME, vm = %vm_name, "Cloning base image for project");
        let result = Command::new("limactl")
            .args(["clone", BASE_IMAGE_NAME, &vm_name])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::BootFailed(format!("Failed to clone base image: {e}")))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            return Err(VmError::BootFailed(format!("Clone failed: {stderr}")));
        }

        Ok(vm_name)
    }

    /// Read the current base image version from ~/.agentii/base-image-version.
    pub async fn base_version(&self) -> String {
        let path = version_file_path();
        match tokio::fs::read_to_string(&path).await {
            Ok(v) => v.trim().to_string(),
            Err(_) => "unknown".to_string(),
        }
    }

    /// Check if a newer base image version is available.
    pub async fn upgrade_available(&self) -> bool {
        let current = self.base_version().await;
        current != BUNDLED_BASE_VERSION && current != "unknown"
    }

    /// Read base image info.
    async fn read_base_info(&self) -> BaseImageInfo {
        BaseImageInfo {
            version: self.base_version().await,
            lima_name: BASE_IMAGE_NAME.to_string(),
            ready: true,
            disk_size_bytes: self.validate_disk_size().await.unwrap_or(0),
            installed: vec![
                "python3".into(),
                "nodejs".into(),
                "uv".into(),
                "goose".into(),
                "edgartools-mcp".into(),
            ],
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Get the disk delta (actual bytes beyond base) for a project VM.
    pub async fn project_disk_delta(&self, project_id: &str) -> u64 {
        let vm_name = project_vm_name(project_id);
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let disk_path = format!("{home}/.lima/{vm_name}/diffdisk");

        let output = Command::new("qemu-img")
            .args(["info", "--output=json", &disk_path])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                serde_json::from_str::<serde_json::Value>(&stdout)
                    .ok()
                    .and_then(|v| v.get("actual-size")?.as_u64())
                    .unwrap_or(0)
            }
            _ => 0,
        }
    }

    // -------------------------------------------------------------------
    // T042: validate_base_image — run detection commands for all 4 CLIs
    // -------------------------------------------------------------------

    /// Validate that all expected CLIs are installed in the base image.
    ///
    /// Runs detection commands for goose, claude, opencode, and codex.
    /// Logs warnings for any missing CLIs but does NOT fail — the base image
    /// is still usable with a subset of CLIs.
    pub async fn validate_base_image(&self) -> Vec<(String, bool)> {
        let checks = vec![
            ("goose", "goose --version"),
            ("claude", "claude --version"),
            ("opencode", "opencode --version"),
            ("codex", "codex --version"),
        ];

        let mut results = Vec::new();

        for (cli, cmd) in &checks {
            let output = Command::new("limactl")
                .args(["shell", BASE_IMAGE_NAME, "--", "bash", "-c", cmd])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await;

            let ok = output.map(|o| o.status.success()).unwrap_or(false);
            if ok {
                info!(cli = %cli, "Base image CLI validation passed");
            } else {
                tracing::warn!(cli = %cli, cmd = %cmd, "Base image CLI validation FAILED — CLI not installed");
            }
            results.push((cli.to_string(), ok));
        }

        results
    }

    // -------------------------------------------------------------------
    // T043: validate_disk_size — warn if base image exceeds 4 GB
    // -------------------------------------------------------------------

    /// Validate that the base image disk size is under the 4 GB target.
    ///
    /// Uses `qemu-img info` to check actual disk usage. Logs a warning
    /// if the image exceeds the threshold but does NOT fail.
    pub async fn validate_disk_size(&self) -> Result<u64, VmError> {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let disk_path = format!("{home}/.lima/{BASE_IMAGE_NAME}/diffdisk");

        let output = Command::new("qemu-img")
            .args(["info", "--output=json", &disk_path])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| VmError::ExecFailed(format!("qemu-img info failed: {e}")))?;

        if !output.status.success() {
            // Try the basedisk path as fallback
            let basedisk_path = format!("{home}/.lima/{BASE_IMAGE_NAME}/basedisk");
            let output2 = Command::new("qemu-img")
                .args(["info", "--output=json", &basedisk_path])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await
                .map_err(|e| VmError::ExecFailed(format!("qemu-img info failed: {e}")))?;

            if !output2.status.success() {
                tracing::warn!("Could not determine base image disk size (qemu-img failed)");
                return Ok(0);
            }

            return Self::parse_disk_size(&output2.stdout);
        }

        Self::parse_disk_size(&output.stdout)
    }

    /// Parse qemu-img JSON output and extract actual-size, warn if > 4 GB.
    fn parse_disk_size(stdout: &[u8]) -> Result<u64, VmError> {
        let text = String::from_utf8_lossy(stdout);
        let actual_size = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v.get("actual-size")?.as_u64())
            .unwrap_or(0);

        const FOUR_GB: u64 = 4 * 1024 * 1024 * 1024;
        if actual_size > FOUR_GB {
            tracing::warn!(
                actual_bytes = actual_size,
                limit_bytes = FOUR_GB,
                "Base image exceeds 4 GB target — consider pruning caches"
            );
        } else {
            info!(
                actual_mb = actual_size / (1024 * 1024),
                "Base image disk size within 4 GB target"
            );
        }

        Ok(actual_size)
    }

    /// Write version to ~/.agentii/base-image-version.
    async fn write_version(&self, version: &str) {
        let path = version_file_path();
        if let Some(parent) = path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        let _ = tokio::fs::write(&path, version).await;
    }

    /// Render template with dummy paths for base image creation.
    async fn render_template_for_base_image(&self) -> Result<String, std::io::Error> {
        let template_content = fs::read_to_string(&self.template_path).await?;
        
        // Create temporary directories for base image mounts
        let temp_dir = std::env::temp_dir();
        let workspace_path = temp_dir.join("agentii-base-workspace");
        let pv_path = temp_dir.join("agentii-base-pv");
        
        let _ = fs::create_dir_all(&workspace_path).await;
        let _ = fs::create_dir_all(&pv_path).await;
        
        // Replace placeholders with actual paths
        let rendered = template_content
            .replace("{{workspace_host_path}}", &workspace_path.display().to_string())
            .replace("{{persistent_volume_host_path}}", &pv_path.display().to_string())
            .replace("{{cpus}}", "2")
            .replace("{{ram_mb}}", "2048")
            .replace("{{mount_writable}}", "true")
            .replace("{{iptables_rules}}", "# No rules for base image");
        
        Ok(rendered)
    }
}

/// Generate a deterministic VM name from project ID.
pub fn project_vm_name(project_id: &str) -> String {
    // Use first 12 chars of project_id for shorter names
    let short = if project_id.len() > 12 {
        &project_id[..12]
    } else {
        project_id
    };
    format!(
        "agentii-{}",
        short.replace('/', "-").replace('\\', "-")
    )
}

/// Path to the base image version file.
fn version_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".agentii")
        .join("base-image-version")
}
