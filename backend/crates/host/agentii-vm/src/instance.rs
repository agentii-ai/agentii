use std::path::PathBuf;
use std::time::Instant;

use agentii_protocol::vm::{VmBackend, VmConfig, VmStatus};

/// Drain phase during VM shutdown.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrainPhase {
    /// Phase 1: SIGTERM sent, waiting for graceful exit.
    Graceful,
    /// Phase 2: SIGKILL sent, waiting for forced exit.
    Terminate,
    /// Phase 3: VM stop command issued.
    Force,
}

/// A single VM instance managed by the pool.
#[derive(Debug)]
pub struct VmInstance {
    /// Unique project identifier this VM serves.
    pub project_id: String,
    /// Lima/OrbStack VM name (derived from project_id).
    pub vm_name: String,
    /// Current status.
    pub status: VmStatus,
    /// Backend engine used.
    pub backend: VmBackend,
    /// VM configuration.
    pub config: VmConfig,
    /// Host workspace directory mounted into the VM.
    pub workspace_path: PathBuf,
    /// Path to per-project persistent volume on host.
    pub persistent_volume_path: PathBuf,
    /// Last time this VM was actively used (for LRU eviction).
    pub last_active: Instant,
    /// Number of IDE windows currently using this VM.
    pub window_count: u32,
    /// Base image version this VM was cloned from.
    pub base_image_version: String,
    /// Whether this VM was evicted by LRU (needs re-clone vs simple resume).
    pub evicted: bool,
    /// Current drain phase (None if not draining).
    pub drain_phase: Option<DrainPhase>,
    /// Detected CLI agents available in this VM. Populated after first boot.
    pub installed_clis: Vec<String>,
}

impl VmInstance {
    pub fn new(
        project_id: String,
        workspace_path: PathBuf,
        persistent_volume_path: PathBuf,
        config: VmConfig,
    ) -> Self {
        Self::with_base_image_version(project_id, workspace_path, persistent_volume_path, config, String::new())
    }

    pub fn with_base_image_version(
        project_id: String,
        workspace_path: PathBuf,
        persistent_volume_path: PathBuf,
        config: VmConfig,
        base_image_version: String,
    ) -> Self {
        let vm_name = format!("agentii-{}", project_id.replace('/', "-"));
        Self {
            project_id,
            vm_name,
            status: VmStatus::Stopped,
            backend: config.backend,
            config,
            workspace_path,
            persistent_volume_path,
            last_active: Instant::now(),
            window_count: 0,
            base_image_version,
            evicted: false,
            drain_phase: None,
            installed_clis: Vec::new(),
        }
    }

    /// Touch the last_active timestamp (called on every user interaction).
    pub fn touch(&mut self) {
        self.last_active = Instant::now();
    }

    /// Increment window count when a new IDE window opens this project.
    pub fn add_window(&mut self) {
        self.window_count += 1;
        self.touch();
    }

    /// Decrement window count. Returns true if no windows remain.
    pub fn remove_window(&mut self) -> bool {
        self.window_count = self.window_count.saturating_sub(1);
        self.window_count == 0
    }
}
