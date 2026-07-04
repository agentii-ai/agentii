//! Structured JSON event logger for VM operations.
//! Writes to ~/.agentii/logs/vm.jsonl with log rotation.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

/// Structured event for VM observability logging.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmEvent {
    /// ISO 8601 timestamp.
    pub ts: String,
    /// Project UUID.
    pub project_id: String,
    /// Event type.
    pub event: VmEventType,
    /// Duration in milliseconds (for timed operations).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// Additional details.
    #[serde(default)]
    pub details: serde_json::Value,
    /// Log level.
    pub level: LogLevel,
}

/// Types of VM events.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmEventType {
    VmBoot,
    VmStop,
    VmError,
    VmHealth,
    VmEvict,
    McpRestart,
    McpHealth,
    BaseImageCreate,
    BaseImageUpgrade,
    WorkspaceExport,
    WorkspaceImport,
}

/// Log levels for VM events.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

/// Structured JSON event logger for VM operations.
/// Appends events as JSON lines to ~/.agentii/logs/vm.jsonl.
pub struct VmEventLogger {
    log_path: PathBuf,
}

impl VmEventLogger {
    /// Maximum log file size before rotation (10 MB).
    const MAX_LOG_SIZE: u64 = 10 * 1024 * 1024;

    /// Create a logger with the default log path.
    pub fn new() -> Self {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        Self {
            log_path: PathBuf::from(home)
                .join(".agentii")
                .join("logs")
                .join("vm.jsonl"),
        }
    }

    /// Create a logger with a custom path (for testing).
    pub fn with_path(path: PathBuf) -> Self {
        Self { log_path: path }
    }

    /// Log a VM event. Creates the log directory on first write.
    pub async fn log(&self, event: &VmEvent) {
        // Ensure directory exists
        if let Some(parent) = self.log_path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }

        // Check rotation before writing
        self.rotate_if_needed().await;

        // Serialize and append
        let mut line = match serde_json::to_string(event) {
            Ok(json) => json,
            Err(e) => {
                tracing::warn!(error = %e, "Failed to serialize VM event");
                return;
            }
        };
        line.push('\n');

        match tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .await
        {
            Ok(mut file) => {
                if let Err(e) = file.write_all(line.as_bytes()).await {
                    tracing::warn!(error = %e, "Failed to write VM event log");
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, path = %self.log_path.display(), "Failed to open VM event log");
            }
        }
    }

    /// Log a convenience event with auto-generated timestamp.
    pub async fn log_event(
        &self,
        project_id: &str,
        event_type: VmEventType,
        level: LogLevel,
        duration_ms: Option<u64>,
        details: serde_json::Value,
    ) {
        let event = VmEvent {
            ts: chrono::Utc::now().to_rfc3339(),
            project_id: project_id.to_string(),
            event: event_type,
            duration_ms,
            details,
            level,
        };
        self.log(&event).await;
    }

    /// Rotate log file if it exceeds MAX_LOG_SIZE.
    /// Renames current file to .1 (keeps only 1 backup).
    async fn rotate_if_needed(&self) {
        let metadata = match tokio::fs::metadata(&self.log_path).await {
            Ok(m) => m,
            Err(_) => return, // File doesn't exist yet, no rotation needed
        };

        if metadata.len() < Self::MAX_LOG_SIZE {
            return;
        }

        let backup_path = self.log_path.with_extension("jsonl.1");

        // Remove old backup if exists
        let _ = tokio::fs::remove_file(&backup_path).await;

        // Rename current to backup
        if let Err(e) = tokio::fs::rename(&self.log_path, &backup_path).await {
            tracing::warn!(error = %e, "Failed to rotate VM event log");
        } else {
            tracing::info!("Rotated VM event log");
        }
    }
}

impl Default for VmEventLogger {
    fn default() -> Self {
        Self::new()
    }
}
