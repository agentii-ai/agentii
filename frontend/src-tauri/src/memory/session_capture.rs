use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};

const MAX_PTY_BUFFER_LINES: usize = 500;
const FLUSH_PROMPT: &str = include_str!("../../templates/memory_flush_prompt.md");
const SILENT_TURN_TIMEOUT: Duration = Duration::from_secs(30);

/// Per-terminal-tab session buffer holding PTY output and metadata.
pub struct SessionBuffer {
    pub agent_id: String,
    pub session_start: String, // ISO-8601
    pub pty_buffer: VecDeque<String>,
}

impl SessionBuffer {
    pub fn new(agent_id: &str, session_start: &str) -> Self {
        Self {
            agent_id: agent_id.to_string(),
            session_start: session_start.to_string(),
            pty_buffer: VecDeque::with_capacity(MAX_PTY_BUFFER_LINES),
        }
    }

    /// Append a line to the rolling PTY buffer. Evicts oldest when over limit.
    pub fn push_line(&mut self, line: &str) {
        if self.pty_buffer.len() >= MAX_PTY_BUFFER_LINES {
            self.pty_buffer.pop_front();
        }
        self.pty_buffer.push_back(line.to_string());
    }

    /// Join all buffered lines into a single string.
    pub fn get_buffer_content(&self) -> String {
        self.pty_buffer
            .iter()
            .cloned()
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// Manages session buffers for all active terminal tabs.
pub struct SessionBufferManager {
    buffers: Mutex<HashMap<String, SessionBuffer>>,
}

impl SessionBufferManager {
    pub fn new() -> Self {
        Self {
            buffers: Mutex::new(HashMap::new()),
        }
    }

    /// Create a new buffer for a terminal tab.
    pub fn create_buffer(&self, tab_id: &str, agent_id: &str, session_start: &str) {
        let mut map = self.buffers.lock().unwrap();
        map.insert(
            tab_id.to_string(),
            SessionBuffer::new(agent_id, session_start),
        );
    }

    /// Push a PTY output line to a tab's buffer.
    pub fn push_line(&self, tab_id: &str, line: &str) {
        let mut map = self.buffers.lock().unwrap();
        if let Some(buf) = map.get_mut(tab_id) {
            buf.push_line(line);
        }
    }

    /// Remove and return a tab's buffer (on tab close).
    pub fn take_buffer(&self, tab_id: &str) -> Option<SessionBuffer> {
        let mut map = self.buffers.lock().unwrap();
        map.remove(tab_id)
    }

    /// Check if a buffer exists for a tab.
    pub fn has_buffer(&self, tab_id: &str) -> bool {
        let map = self.buffers.lock().unwrap();
        map.contains_key(tab_id)
    }
}

impl Default for SessionBufferManager {
    fn default() -> Self {
        Self::new()
    }
}

/// JSON response from the silent memory turn LLM call (Contract 4).
#[derive(Deserialize, Serialize, Debug)]
pub struct MemoryFlushResponse {
    pub session_content: String,
    pub snapshot_entries: String,
}

/// Configuration for the LLM provider used by the silent memory turn.
#[derive(Clone, Debug)]
pub struct LlmConfig {
    pub api_url: String,
    pub api_key: String,
    pub model: String,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            api_url: "https://api.anthropic.com/v1/messages".to_string(),
            api_key: String::new(),
            model: "claude-3-5-haiku-latest".to_string(),
        }
    }
}

/// Execute the silent memory turn: call LLM to consolidate PTY output into
/// session file + snapshot entries. Falls back to raw capture on failure/timeout.
///
/// This is the core of FR-027: triggered on terminal tab close.
pub async fn execute_silent_memory_turn(
    buffer: &SessionBuffer,
    workspace_root: &Path,
    project_name: &str,
    llm_config: &LlmConfig,
) -> anyhow::Result<()> {
    let session_end = chrono_now_iso();
    let today_date = chrono_today();
    let time_hhmm = chrono_now_hhmm();

    // Read existing snapshot content for context
    let snapshot_path = workspace_root
        .join("snapshots")
        .join(format!("snapshot_{}.md", today_date));
    let existing_snapshot = fs::read_to_string(&snapshot_path).unwrap_or_default();

    // Redact PTY buffer before sending to LLM
    let redacted_output = redact_pty_buffer(&buffer.get_buffer_content());

    // Build the flush prompt
    let prompt = build_flush_prompt(
        &buffer.agent_id,
        &buffer.session_start,
        &session_end,
        project_name,
        &redacted_output,
        &today_date,
        &existing_snapshot,
    );

    // Call LLM with 30s timeout, fallback on any failure
    let result = tokio::time::timeout(
        SILENT_TURN_TIMEOUT,
        call_llm_for_flush(&prompt, llm_config),
    )
    .await;

    match result {
        Ok(Ok(response)) => {
            write_memory_turn_output(
                workspace_root,
                &response.session_content,
                &response.snapshot_entries,
                &today_date,
                &time_hhmm,
            )?;
            Ok(())
        }
        Ok(Err(e)) => {
            eprintln!("Silent memory turn LLM error: {e}. Writing fallback.");
            write_fallback_session(workspace_root, buffer, &session_end, &today_date, &time_hhmm)?;
            Ok(())
        }
        Err(_timeout) => {
            eprintln!("Silent memory turn timed out after 30s. Writing fallback.");
            write_fallback_session(workspace_root, buffer, &session_end, &today_date, &time_hhmm)?;
            Ok(())
        }
    }
}

/// Call the LLM provider to produce the memory flush response.
/// Uses Anthropic Messages API format (Haiku-class model).
async fn call_llm_for_flush(
    prompt: &str,
    config: &LlmConfig,
) -> anyhow::Result<MemoryFlushResponse> {
    if config.api_key.is_empty() {
        anyhow::bail!("LLM API key not configured for silent memory turn");
    }

    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": config.model,
        "max_tokens": 2048,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    });

    let resp = client
        .post(&config.api_url)
        .header("x-api-key", &config.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        anyhow::bail!("LLM API returned {status}: {text}");
    }

    let api_resp: serde_json::Value = resp.json().await?;

    // Extract text content from Anthropic Messages API response
    let text = api_resp["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|block| block["text"].as_str())
        .unwrap_or("");

    // Parse the JSON from the LLM response text
    // The LLM may wrap it in ```json ... ``` blocks, so strip those
    let cleaned = text
        .trim()
        .strip_prefix("```json")
        .unwrap_or(text.trim())
        .strip_prefix("```")
        .unwrap_or(text.trim())
        .strip_suffix("```")
        .unwrap_or(text.trim())
        .trim();

    let flush_response: MemoryFlushResponse = serde_json::from_str(cleaned)
        .map_err(|e| anyhow::anyhow!("Failed to parse LLM flush response as JSON: {e}"))?;

    Ok(flush_response)
}

/// Resolve a unique session filename, handling collisions.
pub fn resolve_session_filename(
    workspace_root: &Path,
    date: &str,
    time_hhmm: &str,
    suffix: &str,
) -> PathBuf {
    let sessions_dir = workspace_root.join("sessions");
    let _ = fs::create_dir_all(&sessions_dir);

    let base_name = if suffix.is_empty() {
        format!("session_{}_{}.md", date, time_hhmm)
    } else {
        format!("session_{}_{}_{}.md", date, time_hhmm, suffix)
    };

    let candidate = sessions_dir.join(&base_name);
    if !candidate.exists() {
        return candidate;
    }

    // Collision — try _2, _3, etc.
    for i in 2..100 {
        let collision_name = if suffix.is_empty() {
            format!("session_{}_{}_{}.md", date, time_hhmm, i)
        } else {
            format!("session_{}_{}_{}_{}.md", date, time_hhmm, suffix, i)
        };
        let path = sessions_dir.join(&collision_name);
        if !path.exists() {
            return path;
        }
    }

    sessions_dir.join(format!("session_{}_{}_{}.md", date, time_hhmm, "overflow"))
}

/// Ensure today's snapshot file exists with the correct header.
pub fn ensure_snapshot_file(
    workspace_root: &Path,
    date: &str,
) -> anyhow::Result<PathBuf> {
    let snapshots_dir = workspace_root.join("snapshots");
    fs::create_dir_all(&snapshots_dir)?;

    let filename = format!("snapshot_{}.md", date);
    let path = snapshots_dir.join(&filename);

    if !path.exists() {
        let header = format!("# Daily Snapshot — {}\n\n", date);
        fs::write(&path, header)?;
    }

    Ok(path)
}

/// Redact PTY buffer content through the canonical leak detector.
/// Delegates to `security::leak_detector::redact_secrets()` for consistent
/// credential redaction across the entire codebase (FR-028).
pub fn redact_pty_buffer(raw_buffer: &str) -> String {
    crate::security::leak_detector::redact_secrets(raw_buffer)
}

/// Write a fallback session file from raw PTY output.
/// Used when the silent memory turn LLM call fails or times out.
pub fn write_fallback_session(
    workspace_root: &Path,
    buffer: &SessionBuffer,
    session_end: &str,
    date: &str,
    time_hhmm: &str,
) -> anyhow::Result<PathBuf> {
    let path = resolve_session_filename(workspace_root, date, time_hhmm, "fallback");

    let redacted_output = redact_pty_buffer(&buffer.get_buffer_content());

    let content = format!(
        "---\nagent: {}\nstarted: {}\nended: {}\nduration_minutes: 0\n---\n\n## Summary\nFallback session capture — silent memory turn failed or timed out.\n\n## Raw Terminal Output\n```\n{}\n```\n",
        buffer.agent_id,
        buffer.session_start,
        session_end,
        redacted_output
    );

    fs::write(&path, content)?;
    Ok(path)
}

/// Build the memory flush prompt with session context.
pub fn build_flush_prompt(
    agent_id: &str,
    session_start: &str,
    session_end: &str,
    project_name: &str,
    pty_output: &str,
    today_date: &str,
    existing_snapshot_content: &str,
) -> String {
    FLUSH_PROMPT
        .replace("{{agent_id}}", agent_id)
        .replace("{{session_start}}", session_start)
        .replace("{{session_end}}", session_end)
        .replace("{{project_name}}", project_name)
        .replace("{{pty_output}}", pty_output)
        .replace("{{today_date}}", today_date)
        .replace("{{existing_snapshot_content}}", existing_snapshot_content)
}

/// Write session file and append snapshot entries from the silent memory turn LLM response.
pub fn write_memory_turn_output(
    workspace_root: &Path,
    session_content: &str,
    snapshot_entries: &str,
    date: &str,
    time_hhmm: &str,
) -> anyhow::Result<()> {
    // Write session file
    let session_path = resolve_session_filename(workspace_root, date, time_hhmm, "");
    fs::write(&session_path, session_content)?;

    // Append snapshot entries if non-empty
    let trimmed = snapshot_entries.trim();
    if !trimmed.is_empty() {
        let snapshot_path = ensure_snapshot_file(workspace_root, date)?;
        let mut existing = fs::read_to_string(&snapshot_path)?;
        if !existing.ends_with('\n') {
            existing.push('\n');
        }
        existing.push_str(trimmed);
        existing.push('\n');
        fs::write(&snapshot_path, existing)?;
    }

    Ok(())
}

// --- Time helpers (simple implementations without chrono dependency) ---

pub(crate) fn chrono_now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let (y, m, d) = days_to_ymd(days);
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, m, d, hours, minutes, seconds)
}

pub(crate) fn chrono_today() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let (y, m, d) = days_to_ymd(days);
    format!("{:04}-{:02}-{:02}", y, m, d)
}

pub(crate) fn chrono_now_hhmm() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    format!("{:02}{:02}", hours, minutes)
}

/// Convert days since Unix epoch to (year, month, day).
fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Civil calendar algorithm from Howard Hinnant
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_buffer_rolling() {
        let mut buf = SessionBuffer::new("goose", "2026-03-27T14:30:00");
        for i in 0..600 {
            buf.push_line(&format!("line {}", i));
        }
        assert_eq!(buf.pty_buffer.len(), MAX_PTY_BUFFER_LINES);
        assert!(buf.get_buffer_content().contains("line 100"));
        assert!(buf.get_buffer_content().contains("line 599"));
        assert!(!buf.get_buffer_content().contains("line 0\n"));
    }

    #[test]
    fn test_resolve_session_filename_no_collision() {
        let tmp = std::env::temp_dir().join("agentii_test_session_name_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let path = resolve_session_filename(&tmp, "2026-03-27", "1430", "");
        assert!(path.to_string_lossy().contains("session_2026-03-27_1430.md"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_resolve_session_filename_with_collision() {
        let tmp = std::env::temp_dir().join("agentii_test_session_collision_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("sessions")).unwrap();

        fs::write(tmp.join("sessions/session_2026-03-27_1430.md"), "").unwrap();

        let path = resolve_session_filename(&tmp, "2026-03-27", "1430", "");
        assert!(path.to_string_lossy().contains("session_2026-03-27_1430_2.md"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_ensure_snapshot_file_creates_with_header() {
        let tmp = std::env::temp_dir().join("agentii_test_snapshot_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let path = ensure_snapshot_file(&tmp, "2026-03-27").unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.starts_with("# Daily Snapshot — 2026-03-27"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_redact_pty_buffer() {
        let input = "Using key sk-abc123def456ghi789jkl012mno345pqr678";
        let redacted = redact_pty_buffer(input);
        assert!(redacted.contains("[REDACTED_SK_KEY]"));
        assert!(!redacted.contains("sk-abc123"));
    }

    #[test]
    fn test_redact_bearer_token() {
        let input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
        let redacted = redact_pty_buffer(input);
        assert!(redacted.contains("[REDACTED_BEARER_TOKEN]"));
    }

    #[test]
    fn test_redact_aws_key() {
        let input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
        let redacted = redact_pty_buffer(input);
        assert!(redacted.contains("[REDACTED_AWS_KEY]"));
    }

    #[test]
    fn test_redact_github_token() {
        // ghp_ tokens need 36+ chars after prefix to match the pattern
        let input = "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop";
        let redacted = redact_pty_buffer(input);
        assert!(redacted.contains("[REDACTED_GH_TOKEN]") || redacted.contains("[REDACTED_CREDENTIAL]"),
            "Expected redaction, got: {}", redacted);
    }

    #[test]
    fn test_write_memory_turn_output() {
        let tmp = std::env::temp_dir().join("agentii_test_memory_turn_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        write_memory_turn_output(
            &tmp,
            "---\nagent: goose\n---\n\n## Summary\nTest session\n",
            "## 14:30 [goose] — Analysis Finding\n- Test finding\n",
            "2026-03-27",
            "1430",
        )
        .unwrap();

        assert!(tmp.join("sessions/session_2026-03-27_1430.md").exists());
        let snapshot = fs::read_to_string(tmp.join("snapshots/snapshot_2026-03-27.md")).unwrap();
        assert!(snapshot.contains("Analysis Finding"));
        assert!(snapshot.contains("Test finding"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_build_flush_prompt_substitution() {
        let prompt = build_flush_prompt(
            "goose",
            "2026-03-27T14:30:00",
            "2026-03-27T15:45:00",
            "NVDA Analysis",
            "user: analyze NVDA\nassistant: ...",
            "2026-03-27",
            "# Daily Snapshot — 2026-03-27\n",
        );
        assert!(prompt.contains("goose"));
        assert!(prompt.contains("NVDA Analysis"));
        assert!(prompt.contains("2026-03-27"));
        assert!(!prompt.contains("{{agent_id}}"));
        assert!(!prompt.contains("{{project_name}}"));
    }

    #[test]
    fn test_chrono_today_format() {
        let today = chrono_today();
        assert_eq!(today.len(), 10); // yyyy-mm-dd
        assert_eq!(&today[4..5], "-");
        assert_eq!(&today[7..8], "-");
    }

    #[test]
    fn test_chrono_now_hhmm_format() {
        let hhmm = chrono_now_hhmm();
        assert_eq!(hhmm.len(), 4);
    }

    #[test]
    fn test_session_buffer_manager() {
        let mgr = SessionBufferManager::new();
        mgr.create_buffer("tab-1", "goose", "2026-03-27T14:30:00");
        assert!(mgr.has_buffer("tab-1"));
        assert!(!mgr.has_buffer("tab-2"));

        mgr.push_line("tab-1", "hello world");
        let buf = mgr.take_buffer("tab-1").unwrap();
        assert_eq!(buf.agent_id, "goose");
        assert_eq!(buf.get_buffer_content(), "hello world");
        assert!(!mgr.has_buffer("tab-1"));
    }

    #[test]
    fn test_memory_flush_response_parse() {
        let json = r#"{"session_content": "---\nagent: goose\n---\n\n## Summary\nTest", "snapshot_entries": ""}"#;
        let resp: MemoryFlushResponse = serde_json::from_str(json).unwrap();
        assert!(resp.session_content.contains("goose"));
        assert!(resp.snapshot_entries.is_empty());
    }
}
