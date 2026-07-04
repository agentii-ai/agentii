use std::path::PathBuf;

use tracing::info;

/// Manages per-project persistent volumes on the host.
///
/// Layout: `~/.agentii/vm-state/<project_id>/`
/// Contains: CLI configs (.claude/, .config/goose/, .opencode/), cached CLI installs.
/// Mounted at VM home directory overlay, survives VM stop/restart/LRU eviction.
pub struct PersistentVolumeManager {
    /// Base path: ~/.agentii/vm-state/
    base_path: PathBuf,
}

impl PersistentVolumeManager {
    pub fn new(base_path: PathBuf) -> Self {
        Self { base_path }
    }

    /// Default base path using the user's home directory.
    pub fn default_base() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
        Self::new(home.join(".agentii").join("vm-state"))
    }

    /// Get the persistent volume path for a project, creating if needed.
    pub async fn get_or_create(&self, project_id: &str) -> std::io::Result<PathBuf> {
        let path = self.base_path.join(sanitize_project_id(project_id));
        tokio::fs::create_dir_all(&path).await?;
        info!(project = %project_id, path = %path.display(), "Persistent volume ready");
        Ok(path)
    }

    /// Check if a persistent volume exists for a project.
    pub fn exists(&self, project_id: &str) -> bool {
        self.base_path
            .join(sanitize_project_id(project_id))
            .exists()
    }

    /// Delete a persistent volume for a project.
    pub async fn delete(&self, project_id: &str) -> std::io::Result<()> {
        let path = self.base_path.join(sanitize_project_id(project_id));
        if path.exists() {
            tokio::fs::remove_dir_all(&path).await?;
        }
        Ok(())
    }

    /// List all project IDs with persistent volumes.
    pub async fn list_projects(&self) -> std::io::Result<Vec<String>> {
        let mut projects = Vec::new();
        if !self.base_path.exists() {
            return Ok(projects);
        }
        let mut entries = tokio::fs::read_dir(&self.base_path).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    projects.push(name.to_string());
                }
            }
        }
        Ok(projects)
    }
}

/// Sanitize project_id for use as directory name.
fn sanitize_project_id(project_id: &str) -> String {
    project_id
        .replace('/', "_")
        .replace('\\', "_")
        .replace(' ', "_")
        .replace(':', "_")
}

/// Add `dirs` dependency helper.
mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        std::env::var("HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from))
    }
}
