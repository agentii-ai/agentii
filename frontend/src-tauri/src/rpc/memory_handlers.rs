use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use crate::memory::inject::{handle_memory_changed, is_allowed_memory_file};
use crate::memory::session_capture::SessionBufferManager;

/// Shared application state managed by Tauri.
pub struct MemoryState {
    pub workspace_root: PathBuf,
    pub project_name: String,
    pub session_buffers: Arc<SessionBufferManager>,
}

// --- Request/Response types ---

#[derive(Serialize, Deserialize, Clone)]
pub struct MemoryReadResponse {
    pub content: String,
    pub exists: bool,
    pub last_modified: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MemoryWriteResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SnapshotEntry {
    pub filename: String,
    pub date: String,
    pub size_bytes: u64,
    pub entry_count: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionEntry {
    pub filename: String,
    pub date: String,
    pub time: String,
    pub agent: String,
    pub duration_minutes: u64,
    pub summary_first_line: String,
    pub is_fallback: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MemoryFileReadResponse {
    pub content: String,
    pub exists: bool,
}

// --- Tauri command handlers ---

/// Tauri command: memory_read — reads agentii.md or style.md
#[tauri::command]
pub fn memory_read(
    state: tauri::State<'_, MemoryState>,
    file: String,
) -> Result<MemoryReadResponse, String> {
    // Security: only allow reading allowed memory files
    if !is_allowed_memory_file(&file) {
        return Ok(MemoryReadResponse {
            content: String::new(),
            exists: false,
            last_modified: String::new(),
        });
    }

    let file_path = state.workspace_root.join(&file);
    if file_path.exists() {
        let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        let last_modified = fs::metadata(&file_path)
            .and_then(|m| m.modified())
            .map(|t| {
                let duration = t
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default();
                format!("{}Z", duration.as_secs())
            })
            .unwrap_or_default();
        Ok(MemoryReadResponse {
            content,
            exists: true,
            last_modified,
        })
    } else {
        Ok(MemoryReadResponse {
            content: String::new(),
            exists: false,
            last_modified: String::new(),
        })
    }
}

/// Tauri command: memory_write — writes agentii.md or style.md, triggers re-injection
#[tauri::command]
pub fn memory_write(
    state: tauri::State<'_, MemoryState>,
    file: String,
    content: String,
) -> Result<MemoryWriteResponse, String> {
    // Security: only allow writing to allowed memory files
    if !is_allowed_memory_file(&file) {
        return Ok(MemoryWriteResponse {
            success: false,
            error: Some(format!("File '{}' is not a writable memory file", file)),
        });
    }

    let file_path = state.workspace_root.join(&file);
    match fs::write(&file_path, &content) {
        Ok(()) => {
            // Trigger re-injection into CLI instruction files
            let _ = handle_memory_changed(&state.workspace_root, &file);
            Ok(MemoryWriteResponse {
                success: true,
                error: None,
            })
        }
        Err(e) => Ok(MemoryWriteResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// Tauri command: memory_list_snapshots — lists snapshot files sorted by date descending
#[tauri::command]
pub fn memory_list_snapshots(
    state: tauri::State<'_, MemoryState>,
) -> Result<Vec<SnapshotEntry>, String> {
    let snapshots_dir = state.workspace_root.join("snapshots");
    let mut snapshots = Vec::new();

    if let Ok(entries) = fs::read_dir(&snapshots_dir) {
        for entry in entries.flatten() {
            let filename = entry.file_name().to_string_lossy().to_string();
            if filename.starts_with("snapshot_") && filename.ends_with(".md") {
                let date = filename
                    .strip_prefix("snapshot_")
                    .and_then(|s| s.strip_suffix(".md"))
                    .unwrap_or("")
                    .to_string();

                let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

                // Count ## headings as approximate entry count
                let content = fs::read_to_string(entry.path()).unwrap_or_default();
                let entry_count = content
                    .lines()
                    .filter(|l| l.starts_with("## ") && !l.starts_with("## Daily"))
                    .count();

                snapshots.push(SnapshotEntry {
                    filename,
                    date,
                    size_bytes,
                    entry_count,
                });
            }
        }
    }

    snapshots.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(snapshots)
}

/// Tauri command: memory_list_sessions — lists session files sorted by date/time descending
#[tauri::command]
pub fn memory_list_sessions(
    state: tauri::State<'_, MemoryState>,
) -> Result<Vec<SessionEntry>, String> {
    let sessions_dir = state.workspace_root.join("sessions");
    let mut sessions = Vec::new();

    if let Ok(entries) = fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let filename = entry.file_name().to_string_lossy().to_string();
            if filename.starts_with("session_") && filename.ends_with(".md") {
                let is_fallback = filename.contains("_fallback");

                // Parse date and time from filename: session_yyyy-mm-dd_HHmm.md
                let stem = filename
                    .strip_prefix("session_")
                    .and_then(|s| s.strip_suffix(".md"))
                    .unwrap_or("");

                let parts: Vec<&str> = stem.splitn(3, '_').collect();
                let date = parts.first().unwrap_or(&"").to_string();
                let time_raw = parts.get(1).unwrap_or(&"");
                let time = if time_raw.len() >= 4 {
                    format!("{}:{}", &time_raw[..2], &time_raw[2..4])
                } else {
                    time_raw.to_string()
                };

                // Parse YAML frontmatter for agent and duration
                let content = fs::read_to_string(entry.path()).unwrap_or_default();
                let (agent, duration_minutes, summary_first_line) =
                    parse_session_frontmatter(&content);

                sessions.push(SessionEntry {
                    filename,
                    date,
                    time,
                    agent,
                    duration_minutes,
                    summary_first_line,
                    is_fallback,
                });
            }
        }
    }

    sessions.sort_by(|a, b| b.date.cmp(&a.date).then_with(|| b.time.cmp(&a.time)));
    Ok(sessions)
}

/// Tauri command: memory_read_file — reads any file under snapshots/ or sessions/
#[tauri::command]
pub fn memory_read_file(
    state: tauri::State<'_, MemoryState>,
    path: String,
) -> Result<MemoryFileReadResponse, String> {
    // Security: canonicalize and verify the path is under snapshots/ or sessions/
    let full_path = state.workspace_root.join(&path);

    // Prevent path traversal by checking the resolved path starts with workspace
    let canonical = full_path
        .canonicalize()
        .unwrap_or_else(|_| full_path.clone());
    let workspace_canonical = state
        .workspace_root
        .canonicalize()
        .unwrap_or_else(|_| state.workspace_root.clone());

    if !canonical.starts_with(&workspace_canonical) {
        return Ok(MemoryFileReadResponse {
            content: String::new(),
            exists: false,
        });
    }

    // Only allow reading from snapshots/ and sessions/ subdirectories
    let relative = path.replace('\\', "/");
    if !relative.starts_with("snapshots/") && !relative.starts_with("sessions/") {
        return Ok(MemoryFileReadResponse {
            content: String::new(),
            exists: false,
        });
    }

    if full_path.exists() {
        Ok(MemoryFileReadResponse {
            content: fs::read_to_string(&full_path).unwrap_or_default(),
            exists: true,
        })
    } else {
        Ok(MemoryFileReadResponse {
            content: String::new(),
            exists: false,
        })
    }
}

/// Tauri command: memory_notify_changed — distinct RPC endpoint for settings.memory_changed (Contract 5).
/// Can be called by external triggers (file watchers, VM re-provisioning) independently of memory_write.
/// Re-injects agentii.md/style.md content into all CLI instruction files within the workspace.
#[tauri::command]
pub fn memory_notify_changed(
    state: tauri::State<'_, MemoryState>,
    file: String,
) -> Result<MemoryWriteResponse, String> {
    // Validate the file name — only agentii.md or style.md trigger re-injection
    if !is_allowed_memory_file(&file) {
        return Ok(MemoryWriteResponse {
            success: false,
            error: Some(format!("File '{}' is not a recognized memory file", file)),
        });
    }

    match handle_memory_changed(&state.workspace_root, &file) {
        Ok(()) => Ok(MemoryWriteResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(MemoryWriteResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

/// Tauri command: memory_push_pty_line — push a PTY output line to a tab's buffer
#[tauri::command]
pub fn memory_push_pty_line(
    state: tauri::State<'_, MemoryState>,
    tab_id: String,
    line: String,
) -> Result<(), String> {
    state.session_buffers.push_line(&tab_id, &line);
    Ok(())
}

/// Tauri command: memory_create_buffer — create a session buffer for a new terminal tab
#[tauri::command]
pub fn memory_create_buffer(
    state: tauri::State<'_, MemoryState>,
    tab_id: String,
    agent_id: String,
    session_start: String,
) -> Result<(), String> {
    state
        .session_buffers
        .create_buffer(&tab_id, &agent_id, &session_start);
    Ok(())
}

/// Tauri command: memory_tab_closed — trigger silent memory turn on tab close
#[tauri::command]
pub async fn memory_tab_closed(
    state: tauri::State<'_, MemoryState>,
    tab_id: String,
) -> Result<(), String> {
    use crate::memory::session_capture::{execute_silent_memory_turn, write_fallback_session, LlmConfig};

    let buffer = match state.session_buffers.take_buffer(&tab_id) {
        Some(b) => b,
        None => return Ok(()), // No buffer for this tab — nothing to capture
    };

    // Skip empty sessions (no PTY output)
    if buffer.pty_buffer.is_empty() {
        return Ok(());
    }

    // Load LLM config from environment or defaults
    let llm_config = LlmConfig {
        api_url: std::env::var("AGENTII_LLM_API_URL")
            .unwrap_or_else(|_| "https://api.anthropic.com/v1/messages".to_string()),
        api_key: std::env::var("AGENTII_LLM_API_KEY").unwrap_or_default(),
        model: std::env::var("AGENTII_LLM_MODEL")
            .unwrap_or_else(|_| "claude-3-5-haiku-latest".to_string()),
    };

    let workspace_root = state.workspace_root.clone();
    let project_name = state.project_name.clone();

    // Execute the silent memory turn (async with 30s timeout)
    let result = execute_silent_memory_turn(
        &buffer,
        &workspace_root,
        &project_name,
        &llm_config,
    )
    .await;

    if let Err(e) = result {
        eprintln!("Silent memory turn failed: {e}. Writing fallback.");
        let session_end = crate::memory::session_capture::chrono_now_iso();
        let today = crate::memory::session_capture::chrono_today();
        let time_hhmm = crate::memory::session_capture::chrono_now_hhmm();
        let _ = write_fallback_session(&workspace_root, &buffer, &session_end, &today, &time_hhmm);
    }

    Ok(())
}

/// Parse YAML frontmatter from a session file to extract agent, duration, and summary.
fn parse_session_frontmatter(content: &str) -> (String, u64, String) {
    let mut agent = String::new();
    let mut duration_minutes: u64 = 0;
    let mut summary_first_line = String::new();
    let mut in_frontmatter = false;
    let mut past_frontmatter = false;

    for line in content.lines() {
        if line.trim() == "---" {
            if !in_frontmatter && !past_frontmatter {
                in_frontmatter = true;
                continue;
            } else if in_frontmatter {
                in_frontmatter = false;
                past_frontmatter = true;
                continue;
            }
        }

        if in_frontmatter {
            if let Some(val) = line.strip_prefix("agent:") {
                agent = val.trim().to_string();
            } else if let Some(val) = line.strip_prefix("duration_minutes:") {
                duration_minutes = val.trim().parse().unwrap_or(0);
            }
        }

        if past_frontmatter && summary_first_line.is_empty() {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                summary_first_line = trimmed.to_string();
            }
        }
    }

    (agent, duration_minutes, summary_first_line)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_session_frontmatter() {
        let content = "---\nagent: goose\nstarted: 2026-03-27T14:30:00\nended: 2026-03-27T15:45:00\nduration_minutes: 75\n---\n\n## Summary\nDiscussed NVDA earnings and thesis.\n";
        let (agent, duration, summary) = parse_session_frontmatter(content);
        assert_eq!(agent, "goose");
        assert_eq!(duration, 75);
        assert_eq!(summary, "Discussed NVDA earnings and thesis.");
    }

    #[test]
    fn test_parse_session_frontmatter_empty() {
        let (agent, duration, summary) = parse_session_frontmatter("");
        assert!(agent.is_empty());
        assert_eq!(duration, 0);
        assert!(summary.is_empty());
    }

    #[test]
    fn test_parse_session_frontmatter_no_frontmatter() {
        let content = "# Just a heading\nSome content\n";
        let (agent, duration, summary) = parse_session_frontmatter(content);
        assert!(agent.is_empty());
        assert_eq!(duration, 0);
        // Without frontmatter, past_frontmatter is never set to true,
        // so summary_first_line stays empty — this is correct behavior
        assert!(summary.is_empty());
    }
}
