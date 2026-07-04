//! Generate CLI-specific context files from agentii.md with HTML comment delimiters.
use crate::parser::AgentiiMdParsed;
use std::path::Path;

const AGENTII_MEMORY_START: &str = "<!-- agentii:memory:start -->";
const AGENTII_MEMORY_END: &str = "<!-- agentii:memory:end -->";

pub struct ContextFileGenerator;

impl ContextFileGenerator {
    /// Regenerate all four CLI context files from parsed agentii.md.
    pub fn regenerate_all(workspace_root: &Path, parsed: &AgentiiMdParsed) {
        let block = build_memory_block(parsed);
        inject_or_create(workspace_root.join("CLAUDE.md"), &block, "claude");
        inject_or_create(workspace_root.join(".goosehints"), &block, "goose");
        let opencode_dir = workspace_root.join(".opencode");
        let _ = std::fs::create_dir_all(&opencode_dir);
        inject_or_create(opencode_dir.join("instructions.md"), &block, "opencode");
        inject_or_create(workspace_root.join("codex.md"), &block, "codex");
    }
}

fn build_memory_block(parsed: &AgentiiMdParsed) -> String {
    let mut block = String::new();
    block.push_str(AGENTII_MEMORY_START);
    block.push('\n');
    block.push_str("## Agentii Financial Context\n\n");

    if !parsed.tickers.is_empty() {
        block.push_str(&format!("**Tickers**: {}\n\n", parsed.tickers.join(", ")));
    }
    if let Some(name) = &parsed.company_name {
        block.push_str(&format!("**Company**: {name}\n\n"));
    }

    // Level 1 content (truncated to 2KB for CLI context files)
    let level1 = if parsed.level1_content.len() > 2048 {
        &parsed.level1_content[..2048]
    } else {
        &parsed.level1_content
    };
    block.push_str(level1);
    block.push('\n');

    if let Some(snapshot) = &parsed.today_snapshot {
        block.push_str("\n### Today's Market Notes\n\n");
        let snap = if snapshot.len() > 1024 { &snapshot[..1024] } else { snapshot };
        block.push_str(snap);
        block.push('\n');
    }

    block.push_str(AGENTII_MEMORY_END);
    block.push('\n');
    block
}

fn inject_or_create(path: impl AsRef<Path>, block: &str, _cli: &str) {
    let path = path.as_ref();
    if path.exists() {
        if let Ok(existing) = std::fs::read_to_string(path) {
            let updated = if existing.contains(AGENTII_MEMORY_START) {
                // Replace existing block
                let start = existing.find(AGENTII_MEMORY_START).unwrap();
                let end = existing.find(AGENTII_MEMORY_END)
                    .map(|i| i + AGENTII_MEMORY_END.len() + 1)
                    .unwrap_or(existing.len());
                format!("{}{}{}", &existing[..start], block, &existing[end..])
            } else {
                format!("{existing}\n\n{block}")
            };
            let _ = std::fs::write(path, updated);
        }
    } else {
        let _ = std::fs::write(path, block);
    }
}
