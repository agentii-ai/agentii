//! Workspace export/import for portable project archives.
//! Creates .tar.gz archives containing workspace + persistent volume + metadata.

use std::path::{Path, PathBuf};

use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use tracing::info;

/// Metadata included in export archives.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMetadata {
    /// Archive format version.
    pub format_version: u32,
    /// Project display name.
    pub project_name: String,
    /// Project type (us_stock, crypto, etc.).
    pub project_type: String,
    /// Ticker symbols.
    pub ticker_symbols: Vec<String>,
    /// Base image version at time of export.
    pub base_image_version: String,
    /// Export timestamp (ISO 8601).
    pub exported_at: String,
    /// Agentii version.
    pub agentii_version: String,
}

/// Export a project workspace to a portable archive.
/// Creates `~/.agentii/exports/{project_name}-{date}.tar.gz`
pub async fn export(
    project_name: &str,
    workspace_path: &Path,
    persistent_volume_path: &Path,
    metadata: ExportMetadata,
) -> Result<PathBuf, ExportError> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let exports_dir = PathBuf::from(&home).join(".agentii").join("exports");
    tokio::fs::create_dir_all(&exports_dir)
        .await
        .map_err(ExportError::Io)?;

    let date = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let safe_name = project_name.replace(' ', "-").replace('/', "_");
    let archive_name = format!("{safe_name}-{date}.tar.gz");
    let archive_path = exports_dir.join(&archive_name);

    // Create tar.gz archive synchronously (tar crate is sync)
    let archive_path_clone = archive_path.clone();
    let workspace = workspace_path.to_path_buf();
    let pv = persistent_volume_path.to_path_buf();

    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::create(&archive_path_clone).map_err(ExportError::Io)?;
        let enc = GzEncoder::new(file, Compression::default());
        let mut tar = tar::Builder::new(enc);

        // Add metadata.json
        let meta_json =
            serde_json::to_string_pretty(&metadata).map_err(|e| ExportError::Serialize(e.to_string()))?;
        let mut header = tar::Header::new_gnu();
        header.set_size(meta_json.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        tar.append_data(&mut header, "metadata.json", meta_json.as_bytes())
            .map_err(ExportError::Io)?;

        // Add workspace directory
        if workspace.exists() {
            tar.append_dir_all("workspace", &workspace)
                .map_err(ExportError::Io)?;
        }

        // Add persistent volume (vm-state)
        if pv.exists() {
            tar.append_dir_all("vm-state", &pv)
                .map_err(ExportError::Io)?;
        }

        tar.finish().map_err(ExportError::Io)?;
        Ok::<PathBuf, ExportError>(archive_path_clone)
    })
    .await
    .map_err(|e| ExportError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))??;

    info!(archive = %archive_path.display(), "Project exported successfully");
    Ok(archive_path)
}

/// Import a project from an archive.
/// Extracts to workspace and persistent volume directories.
pub async fn import(
    archive_path: &Path,
    target_workspace_dir: &Path,
    target_pv_dir: &Path,
) -> Result<ExportMetadata, ExportError> {
    let archive = archive_path.to_path_buf();
    let ws = target_workspace_dir.to_path_buf();
    let pv = target_pv_dir.to_path_buf();

    let metadata = tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive).map_err(ExportError::Io)?;
        let dec = flate2::read::GzDecoder::new(file);
        let mut tar = tar::Archive::new(dec);

        let mut metadata: Option<ExportMetadata> = None;

        for entry in tar.entries().map_err(ExportError::Io)? {
            let mut entry = entry.map_err(ExportError::Io)?;
            let path = entry.path().map_err(ExportError::Io)?.to_path_buf();
            let path_str = path.to_string_lossy();

            if path_str == "metadata.json" {
                let mut content = String::new();
                std::io::Read::read_to_string(&mut entry, &mut content).map_err(ExportError::Io)?;
                metadata = Some(
                    serde_json::from_str(&content).map_err(|e| ExportError::Serialize(e.to_string()))?,
                );
            } else if let Some(rel_str) = path_str.strip_prefix("workspace/") {
                let rel = Path::new(rel_str);
                let target = ws.join(rel);
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(ExportError::Io)?;
                }
                if entry.header().entry_type().is_file() {
                    let mut out = std::fs::File::create(&target).map_err(ExportError::Io)?;
                    std::io::copy(&mut entry, &mut out).map_err(ExportError::Io)?;
                } else if entry.header().entry_type().is_dir() {
                    std::fs::create_dir_all(&target).map_err(ExportError::Io)?;
                }
            } else if let Some(rel_str) = path_str.strip_prefix("vm-state/") {
                let rel = Path::new(rel_str);
                let target = pv.join(rel);
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(ExportError::Io)?;
                }
                if entry.header().entry_type().is_file() {
                    let mut out = std::fs::File::create(&target).map_err(ExportError::Io)?;
                    std::io::copy(&mut entry, &mut out).map_err(ExportError::Io)?;
                } else if entry.header().entry_type().is_dir() {
                    std::fs::create_dir_all(&target).map_err(ExportError::Io)?;
                }
            }
        }

        metadata.ok_or_else(|| ExportError::Serialize("No metadata.json found in archive".into()))
    })
    .await
    .map_err(|e| ExportError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))??;

    info!(archive = %archive_path.display(), "Project imported successfully");
    Ok(metadata)
}

/// Errors from export/import operations.
#[derive(Debug, thiserror::Error)]
pub enum ExportError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialize(String),
}
