//! Financial context section — injects agentii.md Level 1 + today's snapshot.

/// Build the financial context section from parsed agentii.md content and optional snapshot.
pub fn financial_context_section(agentii_md_level1: &str, today_snapshot: Option<&str>) -> String {
    let mut section = format!(
        "## Financial Project Context\n\n{agentii_md_level1}\n"
    );
    if let Some(snapshot) = today_snapshot {
        section.push_str("\n## Today's Market Notes\n\n");
        section.push_str(snapshot);
        section.push('\n');
    }
    section
}
