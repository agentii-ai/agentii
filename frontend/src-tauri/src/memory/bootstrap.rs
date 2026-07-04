use std::fs;
use std::path::Path;

const AGENTII_SKELETON: &str = include_str!("../../templates/agentii_skeleton.md");
const STYLE_SKELETON: &str = include_str!("../../templates/style_skeleton.md");

/// Bootstrap the memory directory structure and skeleton files.
///
/// Creates /workspace/snapshots/ and /workspace/sessions/ directories (empty).
/// If /workspace/agentii.md doesn't exist, creates skeleton from canonical template.
/// If /workspace/style.md doesn't exist, creates skeleton from canonical template.
/// Never overwrites existing files.
pub fn bootstrap_memory_structure(
    workspace_root: &Path,
    project_name: &str,
) -> anyhow::Result<()> {
    // Create snapshot and session directories
    let snapshots_dir = workspace_root.join("snapshots");
    let sessions_dir = workspace_root.join("sessions");

    fs::create_dir_all(&snapshots_dir)?;
    fs::create_dir_all(&sessions_dir)?;

    // Create agentii.md from skeleton if missing
    let agentii_path = workspace_root.join("agentii.md");
    if !agentii_path.exists() {
        // Replace all template placeholders with project_name
        let content = AGENTII_SKELETON
            .replace("[PROJECT_NAME]", project_name)
            .replace("[COMPANY]", project_name)
            .replace("[PRIMARY TICKER]", "[TICKER]");
        fs::write(&agentii_path, content)?;
    }

    // Create style.md from skeleton if missing
    let style_path = workspace_root.join("style.md");
    if !style_path.exists() {
        fs::write(&style_path, STYLE_SKELETON)?;
    }

    Ok(())
}

/// Validate that agentii.md has the required sections populated (not just placeholders).
/// Returns a list of warnings for sections that are still placeholder-only.
pub fn validate_agentii_md(workspace_root: &Path) -> Vec<String> {
    let agentii_path = workspace_root.join("agentii.md");
    let mut warnings = Vec::new();

    let content = match fs::read_to_string(&agentii_path) {
        Ok(c) => c,
        Err(_) => {
            warnings.push("agentii.md does not exist".to_string());
            return warnings;
        }
    };

    // Check required sections per FR-005a
    if !content.contains("## Company Identity") {
        warnings.push("Missing required section: ## Company Identity".to_string());
    } else {
        // Check if Company Identity still has only placeholders
        let ci_section = extract_section(&content, "## Company Identity");
        if ci_section.contains("[e.g.,") && !ci_section.contains("Legal Name:") {
            warnings.push("Company Identity section still contains only placeholder values".to_string());
        }
    }

    if !content.contains("## Ticker Symbols") {
        warnings.push("Missing required section: ## Ticker Symbols".to_string());
    } else {
        let ts_section = extract_section(&content, "## Ticker Symbols");
        if ts_section.contains("[e.g.,") && !ts_section.contains("Primary:") {
            warnings.push("Ticker Symbols section still contains only placeholder values".to_string());
        }
    }

    warnings
}

/// Extract the content of a markdown section (from heading to next ## heading or EOF).
fn extract_section(content: &str, heading: &str) -> String {
    if let Some(start) = content.find(heading) {
        let after_heading = &content[start + heading.len()..];
        if let Some(next_section) = after_heading.find("\n## ") {
            after_heading[..next_section].to_string()
        } else {
            after_heading.to_string()
        }
    } else {
        String::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_bootstrap_creates_directories_and_files() {
        let tmp = std::env::temp_dir().join("agentii_test_bootstrap_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        bootstrap_memory_structure(&tmp, "Test Project").unwrap();

        assert!(tmp.join("snapshots").is_dir());
        assert!(tmp.join("sessions").is_dir());
        assert!(tmp.join("agentii.md").exists());
        assert!(tmp.join("style.md").exists());

        let agentii_content = fs::read_to_string(tmp.join("agentii.md")).unwrap();
        assert!(agentii_content.contains("Test Project"));
        // Verify both placeholders were replaced
        assert!(!agentii_content.contains("[PROJECT_NAME]"));
        assert!(!agentii_content.contains("[COMPANY]"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_bootstrap_does_not_overwrite_existing() {
        let tmp = std::env::temp_dir().join("agentii_test_no_overwrite_v2");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        fs::write(tmp.join("agentii.md"), "user content").unwrap();
        bootstrap_memory_structure(&tmp, "Test").unwrap();

        let content = fs::read_to_string(tmp.join("agentii.md")).unwrap();
        assert_eq!(content, "user content");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_validate_agentii_md_missing_file() {
        let tmp = std::env::temp_dir().join("agentii_test_validate_missing");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let warnings = validate_agentii_md(&tmp);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("does not exist"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_validate_agentii_md_with_skeleton() {
        let tmp = std::env::temp_dir().join("agentii_test_validate_skeleton");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        bootstrap_memory_structure(&tmp, "Test").unwrap();
        let warnings = validate_agentii_md(&tmp);
        // Skeleton has the sections but with placeholder values — no warnings for structure
        assert!(warnings.is_empty() || warnings.iter().all(|w| w.contains("placeholder")));

        let _ = fs::remove_dir_all(&tmp);
    }
}
