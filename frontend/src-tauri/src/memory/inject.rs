use std::fs;
use std::path::Path;

const MEMORY_START: &str = "<!-- agentii:memory:start -->";
const MEMORY_END: &str = "<!-- agentii:memory:end -->";
const STYLE_START: &str = "<!-- agentii:style:start -->";
const STYLE_END: &str = "<!-- agentii:style:end -->";

/// Allowed memory file names for write operations (path traversal prevention).
const ALLOWED_MEMORY_FILES: &[&str] = &["agentii.md", "style.md"];

/// Inject memory file content into a CLI instruction file using HTML comment delimiters.
/// Replaces existing injected content between markers; preserves all user-added content.
///
/// - If instruction file doesn't exist, creates it with injected content only
/// - If instruction file exists, replaces content between markers
/// - If markers don't exist in file, appends injected blocks at end
/// - Preserves all content outside the marker pairs
pub fn inject_memory_into_instruction_file(
    instruction_file_path: &Path,
    agentii_md_content: &str,
    style_md_content: &str,
) -> anyhow::Result<()> {
    let memory_block = format!(
        "{}\n{}\n{}",
        MEMORY_START, agentii_md_content, MEMORY_END
    );
    let style_block = format!(
        "{}\n{}\n{}",
        STYLE_START, style_md_content, STYLE_END
    );

    let existing = if instruction_file_path.exists() {
        fs::read_to_string(instruction_file_path)?
    } else {
        String::new()
    };

    let with_memory = replace_or_append_block(&existing, MEMORY_START, MEMORY_END, &memory_block);
    let with_style = replace_or_append_block(&with_memory, STYLE_START, STYLE_END, &style_block);

    if let Some(parent) = instruction_file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(instruction_file_path, with_style)?;

    Ok(())
}

/// Replace content between start/end markers, or append block if markers don't exist.
fn replace_or_append_block(
    content: &str,
    start_marker: &str,
    end_marker: &str,
    new_block: &str,
) -> String {
    if let (Some(start_idx), Some(end_idx)) = (content.find(start_marker), content.find(end_marker))
    {
        if start_idx < end_idx {
            let end_of_marker = end_idx + end_marker.len();
            let mut result = String::with_capacity(content.len());
            result.push_str(&content[..start_idx]);
            result.push_str(new_block);
            result.push_str(&content[end_of_marker..]);
            return result;
        }
    }

    // Markers not found — append
    let mut result = content.to_string();
    if !result.is_empty() && !result.ends_with('\n') {
        result.push('\n');
    }
    if !result.is_empty() {
        result.push('\n');
    }
    result.push_str(new_block);
    result.push('\n');
    result
}

/// Inject agentii.md and style.md content into all CLI instruction files.
/// Reads source files from workspace root, injects into each CLI target.
pub fn inject_all_cli_instruction_files(
    workspace_root: &Path,
) -> anyhow::Result<()> {
    let agentii_content = read_file_or_empty(&workspace_root.join("agentii.md"));
    let style_content = read_file_or_empty(&workspace_root.join("style.md"));

    let targets = [
        workspace_root.join(".goosehints"),
        workspace_root.join("CLAUDE.md"),
        workspace_root.join(".opencode").join("instructions.md"),
        workspace_root.join("codex.md"),
    ];

    for target in &targets {
        inject_memory_into_instruction_file(target, &agentii_content, &style_content)?;
    }

    Ok(())
}

/// Handle re-injection when agentii.md or style.md changes.
/// Called by the settings.memory_changed RPC handler.
pub fn handle_memory_changed(
    workspace_root: &Path,
    _changed_file: &str,
) -> anyhow::Result<()> {
    inject_all_cli_instruction_files(workspace_root)
}

/// Validate that a file name is an allowed memory file (prevents path traversal).
pub fn is_allowed_memory_file(file: &str) -> bool {
    ALLOWED_MEMORY_FILES.contains(&file)
}

fn read_file_or_empty(path: &Path) -> String {
    fs::read_to_string(path).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_inject_creates_new_file() {
        let tmp = std::env::temp_dir().join("agentii_test_inject_new_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let target = tmp.join("CLAUDE.md");
        inject_memory_into_instruction_file(&target, "project info", "style info").unwrap();

        let content = fs::read_to_string(&target).unwrap();
        assert!(content.contains(MEMORY_START));
        assert!(content.contains("project info"));
        assert!(content.contains(MEMORY_END));
        assert!(content.contains(STYLE_START));
        assert!(content.contains("style info"));
        assert!(content.contains(STYLE_END));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_inject_replaces_existing_markers() {
        let tmp = std::env::temp_dir().join("agentii_test_inject_replace_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let target = tmp.join("CLAUDE.md");
        let initial = format!(
            "# User Content\n\n{}\nold memory\n{}\n\n{}\nold style\n{}\n\n# More User Content\n",
            MEMORY_START, MEMORY_END, STYLE_START, STYLE_END
        );
        fs::write(&target, &initial).unwrap();

        inject_memory_into_instruction_file(&target, "new memory", "new style").unwrap();

        let content = fs::read_to_string(&target).unwrap();
        assert!(content.contains("# User Content"));
        assert!(content.contains("new memory"));
        assert!(content.contains("new style"));
        assert!(!content.contains("old memory"));
        assert!(!content.contains("old style"));
        assert!(content.contains("# More User Content"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_inject_appends_when_no_markers() {
        let tmp = std::env::temp_dir().join("agentii_test_inject_append_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let target = tmp.join(".goosehints");
        fs::write(&target, "existing hints\n").unwrap();

        inject_memory_into_instruction_file(&target, "memory", "style").unwrap();

        let content = fs::read_to_string(&target).unwrap();
        assert!(content.starts_with("existing hints\n"));
        assert!(content.contains(MEMORY_START));
        assert!(content.contains("memory"));
        assert!(content.contains(STYLE_START));
        assert!(content.contains("style"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_is_allowed_memory_file() {
        assert!(is_allowed_memory_file("agentii.md"));
        assert!(is_allowed_memory_file("style.md"));
        assert!(!is_allowed_memory_file("../../../etc/passwd"));
        assert!(!is_allowed_memory_file("sessions/session_2026-03-27.md"));
        assert!(!is_allowed_memory_file(""));
    }
}
