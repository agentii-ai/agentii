use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};
use tokio::sync::{mpsc, Mutex};
use tracing::{debug, error, info, warn};

/// Content-hash based file sync between remote storage and a persistent volume.
///
/// Handles first-open download, debounced upload on save, and flush on VM shutdown.
pub struct VolumeSync {
    /// Project identifier.
    project_id: String,
    /// Local persistent volume path.
    volume_path: PathBuf,
    /// Remote storage client.
    storage: Arc<dyn StorageBackend>,
    /// Content hashes of files last synced (path -> hex SHA-256).
    known_hashes: Arc<Mutex<HashMap<String, String>>>,
    /// Debounce sender — file paths queued for upload.
    upload_tx: Option<mpsc::Sender<String>>,
}

/// Trait abstracting remote storage (Supabase Storage, S3, etc.).
///
/// Keys returned by `list_files` and accepted by `download`/`upload`/`delete`
/// MUST be relative to the workspace root (e.g. `agentii.md`, `sessions/session_2026-03-29_1430.md`).
/// The implementation is responsible for mapping these to the actual storage path
/// (e.g. prepending `{user_id}/{project_id}/` for Supabase Storage).
/// `VolumeSync` joins keys directly to the persistent volume path — no prefix stripping.
#[async_trait::async_trait]
pub trait StorageBackend: Send + Sync {
    /// List all file keys under the project prefix.
    /// Keys MUST be relative to workspace root (no `{user_id}/{project_id}/` prefix).
    async fn list_files(&self, project_id: &str) -> Result<Vec<String>, SyncError>;

    /// Download a single file by key. Returns file bytes.
    /// Key is relative to workspace root.
    async fn download(&self, project_id: &str, key: &str) -> Result<Vec<u8>, SyncError>;

    /// Upload a single file by key.
    /// Key is relative to workspace root.
    async fn upload(&self, project_id: &str, key: &str, data: &[u8]) -> Result<(), SyncError>;

    /// Delete a single file by key.
    /// Key is relative to workspace root.
    async fn delete(&self, project_id: &str, key: &str) -> Result<(), SyncError>;
}

/// Errors from sync operations.
#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Storage error: {0}")]
    Storage(String),
    #[error("Hash mismatch for {path}: expected {expected}, got {actual}")]
    HashMismatch {
        path: String,
        expected: String,
        actual: String,
    },
}

/// Stats returned after a sync operation.
#[derive(Debug, Clone, Default)]
pub struct SyncStats {
    pub files_synced: usize,
    pub bytes_transferred: u64,
    pub duration: Duration,
}

impl VolumeSync {
    pub fn new(
        project_id: String,
        volume_path: PathBuf,
        storage: Arc<dyn StorageBackend>,
    ) -> Self {
        Self {
            project_id,
            volume_path,
            storage,
            known_hashes: Arc::new(Mutex::new(HashMap::new())),
            upload_tx: None,
        }
    }

    /// First-open sync: download all project files from storage to the volume.
    ///
    /// Skips files whose local content hash already matches remote.
    pub async fn initial_download(&self) -> Result<SyncStats, SyncError> {
        let start = Instant::now();
        let mut stats = SyncStats::default();

        info!(project = %self.project_id, "Starting initial download sync");

        let remote_keys = self.storage.list_files(&self.project_id).await?;
        info!(
            project = %self.project_id,
            file_count = remote_keys.len(),
            "Found remote files"
        );

        for key in &remote_keys {
            let local_path = self.volume_path.join(key);

            // Check if local file already matches
            if let Some(local_hash) = hash_file_if_exists(&local_path).await {
                let remote_data = self.storage.download(&self.project_id, key).await?;
                let remote_hash = hash_bytes(&remote_data);

                if local_hash == remote_hash {
                    debug!(key = %key, "Skipping (hash match)");
                    let mut hashes = self.known_hashes.lock().await;
                    hashes.insert(key.clone(), local_hash);
                    continue;
                }

                // Hash differs — overwrite local with remote
                write_file_with_parents(&local_path, &remote_data).await?;
                stats.bytes_transferred += remote_data.len() as u64;
                stats.files_synced += 1;

                let mut hashes = self.known_hashes.lock().await;
                hashes.insert(key.clone(), remote_hash);
            } else {
                // File doesn't exist locally — download
                let data = with_backoff(|| self.storage.download(&self.project_id, key)).await?;
                write_file_with_parents(&local_path, &data).await?;
                stats.bytes_transferred += data.len() as u64;
                stats.files_synced += 1;

                let hash = hash_bytes(&data);
                let mut hashes = self.known_hashes.lock().await;
                hashes.insert(key.clone(), hash);
            }
        }

        stats.duration = start.elapsed();
        info!(
            project = %self.project_id,
            files = stats.files_synced,
            bytes = stats.bytes_transferred,
            duration_ms = stats.duration.as_millis(),
            "Initial download sync complete"
        );

        Ok(stats)
    }

    /// Start the debounced upload watcher.
    ///
    /// Returns a sender that accepts relative file paths to queue for upload.
    /// Uploads are debounced by 2 seconds — if the same file is modified multiple
    /// times within the window, only the last version is uploaded.
    pub fn start_upload_watcher(&mut self) -> mpsc::Sender<String> {
        let (tx, rx) = mpsc::channel::<String>(256);
        self.upload_tx = Some(tx.clone());

        let project_id = self.project_id.clone();
        let volume_path = self.volume_path.clone();
        let storage = self.storage.clone();
        let known_hashes = self.known_hashes.clone();

        tokio::spawn(async move {
            debounced_upload_loop(rx, project_id, volume_path, storage, known_hashes).await;
        });

        tx
    }

    /// Flush all dirty files to remote storage.
    ///
    /// Called on VM shutdown to ensure no data loss.
    pub async fn flush(&self) -> Result<SyncStats, SyncError> {
        let start = Instant::now();
        let mut stats = SyncStats::default();

        info!(project = %self.project_id, "Flushing dirty files to storage");

        let hashes = self.known_hashes.lock().await;
        let local_files = list_files_recursive(&self.volume_path).await?;

        for rel_path in &local_files {
            let full_path = self.volume_path.join(rel_path);
            let current_hash = match hash_file_if_exists(&full_path).await {
                Some(h) => h,
                None => continue,
            };

            let needs_upload = match hashes.get(rel_path) {
                Some(known) => *known != current_hash,
                None => true,
            };

            if needs_upload {
                let data = tokio::fs::read(&full_path).await?;
                match with_backoff(|| self.storage.upload(&self.project_id, rel_path, &data)).await
                {
                    Ok(()) => {
                        stats.bytes_transferred += data.len() as u64;
                        stats.files_synced += 1;
                    }
                    Err(e) => {
                        error!(
                            project = %self.project_id,
                            file = %rel_path,
                            error = %e,
                            "Failed to flush file"
                        );
                    }
                }
            }
        }

        drop(hashes);
        stats.duration = start.elapsed();

        info!(
            project = %self.project_id,
            files = stats.files_synced,
            bytes = stats.bytes_transferred,
            duration_ms = stats.duration.as_millis(),
            "Flush complete"
        );

        Ok(stats)
    }
}

// ---------------------------------------------------------------------------
// Debounced upload loop
// ---------------------------------------------------------------------------

async fn debounced_upload_loop(
    mut rx: mpsc::Receiver<String>,
    project_id: String,
    volume_path: PathBuf,
    storage: Arc<dyn StorageBackend>,
    known_hashes: Arc<Mutex<HashMap<String, String>>>,
) {
    const DEBOUNCE: Duration = Duration::from_secs(2);

    // Pending files waiting for debounce expiry.
    let mut pending: HashMap<String, Instant> = HashMap::new();

    loop {
        // Wait for next event or debounce timeout
        let timeout = pending
            .values()
            .map(|t| {
                let elapsed = t.elapsed();
                if elapsed >= DEBOUNCE {
                    Duration::ZERO
                } else {
                    DEBOUNCE - elapsed
                }
            })
            .min()
            .unwrap_or(Duration::from_secs(60));

        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(path) => {
                        pending.insert(path, Instant::now());
                    }
                    None => {
                        // Channel closed — flush remaining
                        for (path, _) in pending.drain() {
                            upload_single(&project_id, &volume_path, &storage, &known_hashes, &path).await;
                        }
                        break;
                    }
                }
            }
            _ = tokio::time::sleep(timeout) => {
                // Process expired entries
                let now = Instant::now();
                let ready: Vec<String> = pending
                    .iter()
                    .filter(|(_, t)| now.duration_since(**t) >= DEBOUNCE)
                    .map(|(k, _)| k.clone())
                    .collect();

                for path in ready {
                    pending.remove(&path);
                    upload_single(&project_id, &volume_path, &storage, &known_hashes, &path).await;
                }
            }
        }
    }

    debug!(project = %project_id, "Upload watcher stopped");
}

async fn upload_single(
    project_id: &str,
    volume_path: &Path,
    storage: &Arc<dyn StorageBackend>,
    known_hashes: &Arc<Mutex<HashMap<String, String>>>,
    rel_path: &str,
) {
    let full_path = volume_path.join(rel_path);
    let data = match tokio::fs::read(&full_path).await {
        Ok(d) => d,
        Err(e) => {
            warn!(file = %rel_path, error = %e, "Failed to read file for upload");
            return;
        }
    };

    let hash = hash_bytes(&data);

    // Skip if unchanged
    {
        let hashes = known_hashes.lock().await;
        if hashes.get(rel_path).map(|h| h.as_str()) == Some(&hash) {
            return;
        }
    }

    match with_backoff(|| storage.upload(project_id, rel_path, &data)).await {
        Ok(()) => {
            debug!(
                project = %project_id,
                file = %rel_path,
                bytes = data.len(),
                "Uploaded file"
            );
            let mut hashes = known_hashes.lock().await;
            hashes.insert(rel_path.to_string(), hash);
        }
        Err(e) => {
            error!(
                project = %project_id,
                file = %rel_path,
                error = %e,
                "Upload failed after retries"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// SHA-256 hash of bytes, returned as lowercase hex.
fn hash_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// Hash a file on disk if it exists. Returns None if the file doesn't exist.
async fn hash_file_if_exists(path: &Path) -> Option<String> {
    let data = tokio::fs::read(path).await.ok()?;
    Some(hash_bytes(&data))
}

/// Write data to a file, creating parent directories as needed.
async fn write_file_with_parents(path: &Path, data: &[u8]) -> Result<(), SyncError> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, data).await?;
    Ok(())
}

/// Recursively list all files under a directory, returning paths relative to `base`.
async fn list_files_recursive(base: &Path) -> Result<Vec<String>, SyncError> {
    let mut result = Vec::new();
    let mut stack = vec![base.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let mut entries = tokio::fs::read_dir(&dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            let ft = entry.file_type().await?;
            let path = entry.path();
            if ft.is_dir() {
                stack.push(path);
            } else if ft.is_file() {
                if let Ok(rel) = path.strip_prefix(base) {
                    result.push(rel.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(result)
}

/// Retry an async operation with exponential backoff (3 attempts, 500ms base).
async fn with_backoff<F, Fut, T>(mut f: F) -> Result<T, SyncError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, SyncError>>,
{
    const MAX_RETRIES: u32 = 3;
    const BASE_DELAY_MS: u64 = 500;

    let mut attempt = 0;
    loop {
        match f().await {
            Ok(val) => return Ok(val),
            Err(e) => {
                attempt += 1;
                if attempt >= MAX_RETRIES {
                    return Err(e);
                }
                let delay = Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt - 1));
                warn!(
                    attempt,
                    max = MAX_RETRIES,
                    delay_ms = delay.as_millis(),
                    error = %e,
                    "Retrying after failure"
                );
                tokio::time::sleep(delay).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_bytes() {
        let hash = hash_bytes(b"hello world");
        assert_eq!(
            hash,
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
    }

    #[test]
    fn test_sync_stats_default() {
        let stats = SyncStats::default();
        assert_eq!(stats.files_synced, 0);
        assert_eq!(stats.bytes_transferred, 0);
    }
}
