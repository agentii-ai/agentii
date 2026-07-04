use std::collections::HashMap;
use std::path::PathBuf;

use agentii_protocol::vm::{PermissionTier, VmStatus};
use async_trait::async_trait;

/// Result type for VM backend operations.
pub type VmResult<T> = Result<T, VmError>;

/// Errors from VM backend operations.
#[derive(Debug, thiserror::Error)]
pub enum VmError {
    #[error("VM boot failed: {0}")]
    BootFailed(String),
    #[error("VM stop failed: {0}")]
    StopFailed(String),
    #[error("VM not found: {0}")]
    NotFound(String),
    #[error("Command execution failed: {0}")]
    ExecFailed(String),
    #[error("Mount failed: {0}")]
    MountFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Backend unavailable: {0}")]
    Unavailable(String),
}

/// Options for booting a VM.
#[derive(Debug, Clone)]
pub struct VmBootOptions {
    pub vm_name: String,
    pub workspace_path: PathBuf,
    pub permission_tier: PermissionTier,
    pub ram_mb: u32,
    pub cpus: u32,
    pub env: HashMap<String, String>,
    pub persistent_volume_path: Option<PathBuf>,
    /// Guest-side workspace mount point (default: "/workspace/").
    pub guest_workspace_path: String,
    /// Guest-side persistent volume mount point (default: "/home/agentii.linux/").
    pub guest_pv_path: String,
    /// Base image name to clone from.
    pub base_image_name: String,
}

impl Default for VmBootOptions {
    fn default() -> Self {
        Self {
            vm_name: String::new(),
            workspace_path: PathBuf::new(),
            permission_tier: PermissionTier::default(),
            ram_mb: 1024,
            cpus: 2,
            env: HashMap::new(),
            persistent_volume_path: None,
            guest_workspace_path: "/workspace/".into(),
            guest_pv_path: "/home/agentii.linux/".into(),
            base_image_name: String::new(),
        }
    }
}

/// Options for executing a command inside a VM.
#[derive(Debug, Clone)]
pub struct VmExecOptions {
    pub vm_name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
}

/// Output of a command executed inside a VM.
#[derive(Debug, Clone)]
pub struct VmExecOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Capabilities reported by a VM backend.
#[derive(Debug, Clone)]
pub struct BackendCapabilities {
    /// Whether the backend supports copy-on-write cloning.
    pub supports_clone: bool,
    /// Whether the backend supports full memory+disk snapshots.
    pub supports_snapshot: bool,
    /// Whether the backend supports virtiofs passthrough.
    pub supports_virtiofs: bool,
    /// Whether the backend supports runtime CPU/RAM resize.
    pub supports_resize: bool,
}

impl Default for BackendCapabilities {
    fn default() -> Self {
        Self {
            supports_clone: false,
            supports_snapshot: false,
            supports_virtiofs: false,
            supports_resize: false,
        }
    }
}

/// Trait for VM backend engines (Lima, OrbStack, Firecracker, E2B).
///
/// # E2B Compatibility Notes
/// - All methods use generic types (no Lima-specific assumptions in signatures)
/// - `guest_workspace_path` in VmBootOptions allows backends to use different mount points
/// - `exec()` uses VmExecOptions with env injection (not Lima-specific shell commands)
/// - `mount_workspace()` is a no-op for backends that handle mounts at creation time
/// - `clone_base()` has a default Err implementation for backends without clone support
/// - `capabilities()` reports what features each backend supports
#[async_trait]
pub trait VmBackendTrait: Send + Sync {
    /// Boot a new VM or start an existing stopped VM.
    async fn boot(&self, options: &VmBootOptions) -> VmResult<()>;

    /// Stop a running VM (graceful shutdown).
    async fn stop(&self, vm_name: &str) -> VmResult<()>;

    /// Get current status of a VM.
    async fn status(&self, vm_name: &str) -> VmResult<VmStatus>;

    /// Execute a command inside a running VM.
    async fn exec(&self, options: &VmExecOptions) -> VmResult<VmExecOutput>;

    /// Mount workspace directory into VM.
    async fn mount_workspace(
        &self,
        vm_name: &str,
        host_path: &PathBuf,
        vm_path: &str,
    ) -> VmResult<()>;

    /// Delete a VM entirely.
    async fn delete(&self, vm_name: &str) -> VmResult<()>;

    /// Check if the backend is available on this system.
    async fn is_available(&self) -> bool;

    /// Backend name for logging.
    fn name(&self) -> &str;

    /// Clone the base image to create a new project VM.
    async fn clone_base(&self, _base_name: &str, _new_name: &str) -> VmResult<()> {
        Err(VmError::Unavailable("clone not supported by this backend".into()))
    }

    /// Report backend capabilities.
    fn capabilities(&self) -> BackendCapabilities {
        BackendCapabilities::default()
    }
}
