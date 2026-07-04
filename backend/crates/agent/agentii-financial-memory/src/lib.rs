//! Financial memory management — spec-017 four-level Class A parser.
//! Parses agentii.md, style.md, snapshots/, sessions/ and injects into CLI context files.

pub mod context_generator;
pub mod file_watcher;
pub mod parser;
pub mod prompt_injection;
pub mod templates;

pub use parser::{AgentiiMdParsed, AgentiiMdParser};
pub use context_generator::ContextFileGenerator;
pub use file_watcher::FinancialMemoryWatcher;
pub use prompt_injection::FinancialPromptInjector;
pub use templates::{AGENTII_SKELETON, STYLE_SKELETON};

// T080: Integration test — create agentii.md with NVDA ticker, modify it,
// and verify the 4 context files are regenerated.
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_workspace(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos();
        let dir = std::env::temp_dir().join(format!("agentii-mem-test-{label}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_agentii_md(workspace: &PathBuf, content: &str) {
        fs::write(workspace.join("agentii.md"), content).unwrap();
    }

    fn context_file_contains(path: &PathBuf, needle: &str) -> bool {
        fs::read_to_string(path)
            .map(|c| c.contains(needle))
            .unwrap_or(false)
    }

    /// T080: Create agentii.md with NVDA ticker, regenerate context files,
    /// verify all 4 files are created and contain the NVDA ticker.
    #[test]
    fn regenerate_all_creates_four_context_files_with_nvda_ticker() {
        let workspace = temp_workspace("nvda-initial");

        let agentii_md = "# NVDA Analysis\n\nTicker: NVDA\n\n## Company\nNVIDIA Corporation\n\nSector: Technology\n\nThis is my investment thesis for NVDA.\n";
        write_agentii_md(&workspace, agentii_md);

        let parsed = AgentiiMdParser::parse(&workspace);
        assert!(parsed.tickers.contains(&"NVDA".to_string()), "parser should extract NVDA ticker");

        ContextFileGenerator::regenerate_all(&workspace, &parsed);

        // Verify all 4 context files exist and contain NVDA
        let claude_md = workspace.join("CLAUDE.md");
        let goosehints = workspace.join(".goosehints");
        let opencode_instructions = workspace.join(".opencode").join("instructions.md");
        let codex_md = workspace.join("codex.md");

        assert!(claude_md.exists(), "CLAUDE.md should be created");
        assert!(goosehints.exists(), ".goosehints should be created");
        assert!(opencode_instructions.exists(), ".opencode/instructions.md should be created");
        assert!(codex_md.exists(), "codex.md should be created");

        assert!(context_file_contains(&claude_md, "NVDA"), "CLAUDE.md should contain NVDA");
        assert!(context_file_contains(&goosehints, "NVDA"), ".goosehints should contain NVDA");
        assert!(context_file_contains(&opencode_instructions, "NVDA"), ".opencode/instructions.md should contain NVDA");
        assert!(context_file_contains(&codex_md, "NVDA"), "codex.md should contain NVDA");

        fs::remove_dir_all(&workspace).ok();
    }

    /// T080: Modify agentii.md (add AAPL ticker) and verify context files are regenerated.
    #[test]
    fn regenerate_all_updates_context_files_after_agentii_md_modification() {
        let workspace = temp_workspace("nvda-modify");

        // Initial: NVDA only
        write_agentii_md(&workspace, "# NVDA\n\nTicker: NVDA\n\nInitial thesis.\n");
        let parsed = AgentiiMdParser::parse(&workspace);
        ContextFileGenerator::regenerate_all(&workspace, &parsed);

        let claude_md = workspace.join("CLAUDE.md");
        assert!(context_file_contains(&claude_md, "NVDA"), "initial CLAUDE.md should contain NVDA");
        assert!(!context_file_contains(&claude_md, "AAPL"), "initial CLAUDE.md should not contain AAPL");

        // Modify: add AAPL
        write_agentii_md(&workspace, "# NVDA + AAPL\n\nTicker: NVDA\nTicker: AAPL\n\nUpdated thesis.\n");
        let parsed2 = AgentiiMdParser::parse(&workspace);
        assert!(parsed2.tickers.contains(&"NVDA".to_string()));
        assert!(parsed2.tickers.contains(&"AAPL".to_string()));

        ContextFileGenerator::regenerate_all(&workspace, &parsed2);

        // All 4 files should now contain both tickers
        for (name, path) in &[
            ("CLAUDE.md", workspace.join("CLAUDE.md")),
            (".goosehints", workspace.join(".goosehints")),
            (".opencode/instructions.md", workspace.join(".opencode").join("instructions.md")),
            ("codex.md", workspace.join("codex.md")),
        ] {
            assert!(context_file_contains(path, "NVDA"), "{name} should contain NVDA after update");
            assert!(context_file_contains(path, "AAPL"), "{name} should contain AAPL after update");
        }

        fs::remove_dir_all(&workspace).ok();
    }

    /// T080: Verify the agentii memory block delimiters are present in all 4 files.
    #[test]
    fn regenerate_all_injects_memory_block_delimiters() {
        let workspace = temp_workspace("delimiters");

        write_agentii_md(&workspace, "Ticker: NVDA\n\nSome content.\n");
        let parsed = AgentiiMdParser::parse(&workspace);
        ContextFileGenerator::regenerate_all(&workspace, &parsed);

        for (name, path) in &[
            ("CLAUDE.md", workspace.join("CLAUDE.md")),
            (".goosehints", workspace.join(".goosehints")),
            (".opencode/instructions.md", workspace.join(".opencode").join("instructions.md")),
            ("codex.md", workspace.join("codex.md")),
        ] {
            assert!(
                context_file_contains(path, "<!-- agentii:memory:start -->"),
                "{name} should contain memory start delimiter"
            );
            assert!(
                context_file_contains(path, "<!-- agentii:memory:end -->"),
                "{name} should contain memory end delimiter"
            );
        }

        fs::remove_dir_all(&workspace).ok();
    }

    /// T080: Verify that regenerating twice replaces the block (not appends).
    #[test]
    fn regenerate_all_replaces_existing_memory_block_not_appends() {
        let workspace = temp_workspace("replace-block");

        write_agentii_md(&workspace, "Ticker: NVDA\n\nFirst run.\n");
        let parsed = AgentiiMdParser::parse(&workspace);
        ContextFileGenerator::regenerate_all(&workspace, &parsed);

        // Second run with different content
        write_agentii_md(&workspace, "Ticker: NVDA\n\nSecond run with more content.\n");
        let parsed2 = AgentiiMdParser::parse(&workspace);
        ContextFileGenerator::regenerate_all(&workspace, &parsed2);

        let claude_md = workspace.join("CLAUDE.md");
        let content = fs::read_to_string(&claude_md).unwrap();

        // The memory block should appear exactly once
        let start_count = content.matches("<!-- agentii:memory:start -->").count();
        let end_count = content.matches("<!-- agentii:memory:end -->").count();
        assert_eq!(start_count, 1, "memory start delimiter should appear exactly once, got {start_count}");
        assert_eq!(end_count, 1, "memory end delimiter should appear exactly once, got {end_count}");

        fs::remove_dir_all(&workspace).ok();
    }
}
