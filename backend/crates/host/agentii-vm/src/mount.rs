use std::path::PathBuf;

/// Configuration for workspace mounting via virtiofs.
#[derive(Debug, Clone)]
pub struct WorkspaceMount {
    /// Host-side project directory.
    pub host_path: PathBuf,
    /// Mount point inside the VM (always /workspace).
    pub vm_path: String,
    /// Whether the mount is writable (depends on permission tier).
    pub writable: bool,
}

impl WorkspaceMount {
    pub fn new(host_path: PathBuf, writable: bool) -> Self {
        Self {
            host_path,
            vm_path: "/workspace".into(),
            writable,
        }
    }

    /// Generate Lima mount configuration string.
    pub fn to_lima_mount_arg(&self) -> String {
        format!("{}:{}", self.host_path.display(), self.vm_path)
    }
}

/// Generic mount configuration for Lima YAML generation.
#[derive(Debug, Clone)]
pub struct MountConfig {
    /// Host-side path.
    pub host_path: PathBuf,
    /// Guest-side mount point.
    pub guest_mount_point: String,
    /// Whether the mount is writable.
    pub writable: bool,
    /// Mount type (virtiofs, 9p, etc.).
    pub mount_type: String,
}

impl MountConfig {
    /// Generate a Lima YAML mount entry string.
    pub fn to_lima_yaml_entry(&self) -> String {
        format!(
            "  - location: \"{}\"\n    mountPoint: \"{}\"\n    writable: {}\n    virtiofs:\n      queueSize: 1024",
            self.host_path.display(),
            self.guest_mount_point,
            self.writable,
        )
    }
}

/// Configuration for per-project persistent volume.
#[derive(Debug, Clone)]
pub struct PersistentVolume {
    /// Host-side persistent volume directory.
    pub host_path: PathBuf,
    /// Mount point inside the VM (home directory overlay).
    pub vm_path: String,
}

impl PersistentVolume {
    pub fn new(host_path: PathBuf) -> Self {
        Self {
            host_path,
            vm_path: "/home/agentii.linux".into(),
        }
    }

    /// Ensure the persistent volume directory exists on host.
    pub async fn ensure_exists(&self) -> std::io::Result<()> {
        tokio::fs::create_dir_all(&self.host_path).await
    }
}
