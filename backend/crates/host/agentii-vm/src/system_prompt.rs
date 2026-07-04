//! System prompt generation and injection for CLI agents.
//!
//! Generates the `agentii_system_prompt` that teaches CLI agents the workspace
//! memory architecture, naming conventions, and directory structure.

// ---------------------------------------------------------------------------
// T020: generate_system_prompt
// ---------------------------------------------------------------------------

/// Generate the agentii system prompt for a workspace.
///
/// Describes the four-level memory hierarchy, conventions, project name,
/// and workspace path. Static at boot — CLI discovers memory files dynamically.
///
/// Paths follow spec 017: sessions and snapshots live at workspace root,
/// NOT under `.agentii/memory/`.
pub fn generate_system_prompt(project_name: &str, workspace_path: &str) -> String {
    // Ensure workspace_path ends with /
    let wp = if workspace_path.ends_with('/') {
        workspace_path.to_string()
    } else {
        format!("{workspace_path}/")
    };
    format!(
        r#"# Agentii Workspace Context

## Project: {project_name}
## Workspace: {wp}

## Workspace Memory System

This workspace uses a four-level markdown memory system. Levels 1-2 (`agentii.md` and
`style.md`) are already injected into your context — you do not need to read them.
You MUST read Level 3 (today's snapshot) at session start and write to Levels 3-4
during your work.

### What's Already in Your Context
- **agentii.md** — Project identity, thesis, key metrics, agent instructions. Already
  loaded above. Only edit when the user explicitly asks you to remember something
  permanently, or when you discover lasting facts (e.g., company name changes, new
  ticker symbols). Location: {wp}agentii.md
- **style.md** — User's analysis style and preferences. Already loaded above. Read-only
  for agents — users configure this via the IDE editor. You may suggest additions but
  must not modify without user confirmation. Location: {wp}style.md

### Read at Session Start
1. `{wp}snapshots/snapshot_<today>.md` — Today's work so far (if exists). Read
   this file to see what has already been discussed or discovered today by any agent.
   Avoid repeating work.

### Writing Rules
- **Daily Snapshot** (`{wp}snapshots/snapshot_yyyy-mm-dd.md`): Append only curated,
  high-value information using one of five category tags. Format each entry as:
  `## HH:MM [agent-id] — [Category]` followed by 3-5 concise bullets.
  Categories: Market Observation, Analysis Finding, Trading View, Decision, Catalyst Update.
  Only write information with lasting value — verified facts, market data, trading views,
  decisions, catalyst updates. Do NOT write routine conversation summaries.
  Do NOT overwrite existing entries — always append below existing content.
- **Session File** (`{wp}sessions/session_yyyy-mm-dd_HHmm.md`): You may write a
  session file when the user says "done", "thanks", or the conversation naturally concludes.
  Use YAML frontmatter (agent, started, ended, duration_minutes) followed by sections:
  Summary, Key Findings, Decisions Made, Action Items, Topics Discussed.
  Do NOT modify existing session files. If correcting a past session, note the correction
  in the current session file or today's snapshot.

### Immutability Rules
- Do NOT modify yesterday's or older snapshot files. If correcting a past observation,
  note the correction in today's snapshot referencing the original date.
- Do NOT modify existing session files.

### Discovering Past Work
To find past sessions: `ls {wp}sessions/` — filenames contain date and time.
To find past snapshots: `ls {wp}snapshots/` — filenames contain date.

## Conventions

- All file paths are relative to {wp}
- Available skills are in {wp}.agentii/skills/
- Project-specific config is in {wp}.agentii/config.toml
"#,
        project_name = project_name,
        wp = wp,
    )
}

// ---------------------------------------------------------------------------
// T021: inject_system_prompt — writes canonical + CLI-specific copies
// ---------------------------------------------------------------------------

/// CLI-specific project instructions file paths (relative to workspace root).
pub const CLI_INSTRUCTIONS_FILES: &[(&str, &str)] = &[
    ("goose", ".goosehints"),
    ("claude", "CLAUDE.md"),
    ("opencode", ".opencode/instructions.md"),
    ("codex", "codex.md"),
];

/// Get the workspace-relative path for a CLI's project instructions file.
pub fn instructions_path_for_cli(cli_id: &str) -> Option<&'static str> {
    CLI_INSTRUCTIONS_FILES
        .iter()
        .find(|(id, _)| *id == cli_id)
        .map(|(_, path)| *path)
}

/// Get all CLI instructions file paths.
pub fn all_instructions_paths() -> Vec<&'static str> {
    CLI_INSTRUCTIONS_FILES.iter().map(|(_, path)| *path).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // T015: test_system_prompt_generation
    #[test]
    fn test_system_prompt_generation() {
        let prompt = generate_system_prompt("NVDA Analysis", "/workspace/");

        // Verify it contains project name
        assert!(prompt.contains("NVDA Analysis"), "Missing project name");

        // Verify four-level memory hierarchy
        assert!(prompt.contains("agentii.md"), "Missing agentii.md reference");
        assert!(prompt.contains("style.md"), "Missing style.md reference");
        assert!(prompt.contains("snapshots/snapshot_"), "Missing snapshot path");
        assert!(prompt.contains("sessions/session_"), "Missing session path");

        // Verify correct paths (workspace root, NOT .agentii/memory/)
        assert!(
            prompt.contains("/workspace/snapshots/snapshot_yyyy-mm-dd.md"),
            "Snapshot path should be at workspace root"
        );
        assert!(
            prompt.contains("/workspace/sessions/session_yyyy-mm-dd_HHmm.md"),
            "Session path should be at workspace root"
        );
        assert!(
            !prompt.contains(".agentii/memory/"),
            "Must NOT reference old .agentii/memory/ path"
        );

        // Verify five snapshot categories
        assert!(prompt.contains("Market Observation"), "Missing snapshot category");
        assert!(prompt.contains("Analysis Finding"), "Missing snapshot category");
        assert!(prompt.contains("Trading View"), "Missing snapshot category");
        assert!(prompt.contains("Decision"), "Missing snapshot category");
        assert!(prompt.contains("Catalyst Update"), "Missing snapshot category");

        // Verify immutability rules
        assert!(prompt.contains("Do NOT modify yesterday"), "Missing immutability rule");

        // Verify discovery instructions
        assert!(prompt.contains("ls /workspace/sessions/"), "Missing session discovery");
        assert!(prompt.contains("ls /workspace/snapshots/"), "Missing snapshot discovery");

        // Verify paths
        assert!(prompt.contains("/workspace/"), "Missing workspace path");
    }

    // T016: test_system_prompt_injection paths
    #[test]
    fn test_system_prompt_injection_paths() {
        // Verify all 4 CLI instruction files are defined
        let paths = all_instructions_paths();
        assert_eq!(paths.len(), 4);
        assert!(paths.contains(&".goosehints"));
        assert!(paths.contains(&"CLAUDE.md"));
        assert!(paths.contains(&".opencode/instructions.md"));
        assert!(paths.contains(&"codex.md"));
    }

    #[test]
    fn test_instructions_path_for_cli() {
        assert_eq!(instructions_path_for_cli("goose"), Some(".goosehints"));
        assert_eq!(instructions_path_for_cli("claude"), Some("CLAUDE.md"));
        assert_eq!(instructions_path_for_cli("opencode"), Some(".opencode/instructions.md"));
        assert_eq!(instructions_path_for_cli("codex"), Some("codex.md"));
        assert_eq!(instructions_path_for_cli("bash"), None);
    }
}
