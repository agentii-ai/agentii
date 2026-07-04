//! Four-level Class A markdown parser for agentii.md, style.md, snapshots, sessions.
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Parsed representation of the four-level agentii memory hierarchy.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentiiMdParsed {
    /// Level 1: agentii.md — company identity, tickers, thesis, catalysts, position, agent instructions
    pub level1_content: String,
    /// Level 1 structured fields
    pub tickers: Vec<String>,
    pub company_name: Option<String>,
    pub sector: Option<String>,
    /// Level 2: style.md — investment philosophy, execution preferences
    pub level2_style: Option<String>,
    /// Level 3: today's snapshot content (most recent snapshot file)
    pub today_snapshot: Option<String>,
    /// Level 4: recent session summaries (last 3 sessions)
    pub recent_sessions: Vec<SessionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub filename: String,
    pub date: String,
    pub summary: String,
    pub key_findings: Vec<String>,
    pub decisions: Vec<String>,
}

pub struct AgentiiMdParser;

impl AgentiiMdParser {
    /// Parse the full four-level memory hierarchy from a workspace root.
    pub fn parse(workspace_root: &Path) -> AgentiiMdParsed {
        let mut parsed = AgentiiMdParsed::default();

        // Level 1: agentii.md
        let agentii_md = workspace_root.join("agentii.md");
        if let Ok(content) = std::fs::read_to_string(&agentii_md) {
            parsed.level1_content = content.clone();
            parsed.tickers = extract_tickers(&content);
            parsed.company_name = extract_h2_section(&content, "Company");
            parsed.sector = extract_field(&content, "Sector:");
        }

        // Level 2: style.md
        let style_md = workspace_root.join("style.md");
        if let Ok(content) = std::fs::read_to_string(&style_md) {
            parsed.level2_style = Some(content);
        }

        // Level 3: today's snapshot
        let snapshots_dir = workspace_root.join("snapshots");
        if snapshots_dir.exists() {
            parsed.today_snapshot = read_today_snapshot(&snapshots_dir);
        }

        // Level 4: recent sessions (last 3)
        let sessions_dir = workspace_root.join("sessions");
        if sessions_dir.exists() {
            parsed.recent_sessions = read_recent_sessions(&sessions_dir, 3);
        }

        parsed
    }
}

fn extract_tickers(content: &str) -> Vec<String> {
    let mut tickers = Vec::new();
    for line in content.lines() {
        if line.starts_with("Ticker:") || line.starts_with("- Ticker:") {
            let ticker = line.split(':').nth(1).unwrap_or("").trim().to_uppercase();
            if !ticker.is_empty() {
                tickers.push(ticker);
            }
        }
    }
    tickers
}

fn extract_h2_section(content: &str, section_name: &str) -> Option<String> {
    let marker = format!("## {section_name}");
    let mut in_section = false;
    let mut lines = Vec::new();
    for line in content.lines() {
        if line.starts_with("## ") {
            if in_section { break; }
            if line == marker { in_section = true; continue; }
        }
        if in_section { lines.push(line); }
    }
    if lines.is_empty() { None } else { Some(lines.join("\n")) }
}

fn extract_field(content: &str, field: &str) -> Option<String> {
    content.lines()
        .find(|l| l.contains(field))
        .and_then(|l| l.split(':').nth(1))
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn read_today_snapshot(snapshots_dir: &Path) -> Option<String> {
    let today = today_date_str();
    let filename = format!("snapshot_{today}.md");
    let path = snapshots_dir.join(&filename);
    std::fs::read_to_string(path).ok()
}

fn read_recent_sessions(sessions_dir: &Path, count: usize) -> Vec<SessionSummary> {
    let mut entries: Vec<_> = std::fs::read_dir(sessions_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "md").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| std::cmp::Reverse(e.file_name()));
    entries.into_iter().take(count).filter_map(|e| {
        let content = std::fs::read_to_string(e.path()).ok()?;
        let filename = e.file_name().to_string_lossy().to_string();
        Some(SessionSummary {
            date: filename.replace("session_", "").replace(".md", ""),
            filename,
            summary: extract_yaml_field(&content, "summary").unwrap_or_default(),
            key_findings: extract_yaml_list(&content, "key_findings"),
            decisions: extract_yaml_list(&content, "decisions"),
        })
    }).collect()
}

fn extract_yaml_field(content: &str, field: &str) -> Option<String> {
    let marker = format!("{field}:");
    content.lines()
        .find(|l| l.trim_start().starts_with(&marker))
        .and_then(|l| l.split(':').nth(1))
        .map(|v| v.trim().trim_matches('"').to_string())
}

/// Extract a YAML list field from a YAML frontmatter block.
/// Handles both inline (`key: [a, b]`) and block (`key:\n  - a\n  - b`) styles.
fn extract_yaml_list(content: &str, field: &str) -> Vec<String> {
    // Find YAML frontmatter delimited by ---
    let body = if content.starts_with("---") {
        let end = content[3..].find("\n---").map(|i| i + 3).unwrap_or(content.len());
        &content[3..end]
    } else {
        content
    };

    let marker = format!("{field}:");
    let mut lines = body.lines().peekable();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if !trimmed.starts_with(&marker) {
            continue;
        }
        // Inline array: key: [a, b, c]
        let after_colon = trimmed[marker.len()..].trim();
        if after_colon.starts_with('[') {
            let inner = after_colon.trim_start_matches('[').trim_end_matches(']');
            return inner
                .split(',')
                .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }
        // Block list: subsequent lines starting with "  - "
        let mut items = Vec::new();
        while let Some(next) = lines.peek() {
            let nt = next.trim();
            if nt.starts_with("- ") {
                items.push(nt[2..].trim().trim_matches('"').trim_matches('\'').to_string());
                lines.next();
            } else if nt.is_empty() {
                lines.next();
            } else {
                break;
            }
        }
        return items;
    }
    Vec::new()
}

fn today_date_str() -> String {
    use chrono::Datelike;
    let now = chrono::Utc::now();
    format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
}

use std::cmp::Reverse;
