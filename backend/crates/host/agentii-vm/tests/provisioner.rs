use agentii_vm::mcp_config::{GlobalMcpConfig, McpToolConfig, ProjectMcpOverrides, merge_configs};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// T062: test_mcp_merge_logic
// ---------------------------------------------------------------------------

#[test]
fn test_mcp_merge_global_enabled_no_override() {
    let mut tools = HashMap::new();
    tools.insert("edgartools".into(), McpToolConfig {
        name: "edgartools".into(),
        command: "python3".into(),
        args: vec!["-m".into(), "edgar.ai".into()],
        env: HashMap::new(),
        enabled: true,
    });
    let global = GlobalMcpConfig { tools, version: 1, updated_at: None };

    let merged = merge_configs(&global, None);
    assert_eq!(merged.len(), 1);
    assert_eq!(merged[0].name, "edgartools");
}

#[test]
fn test_mcp_merge_global_disabled_by_project() {
    let mut tools = HashMap::new();
    tools.insert("edgartools".into(), McpToolConfig {
        name: "edgartools".into(),
        command: "python3".into(),
        args: vec!["-m".into(), "edgar.ai".into()],
        env: HashMap::new(),
        enabled: true,
    });
    let global = GlobalMcpConfig { tools, version: 1, updated_at: None };

    let overrides = ProjectMcpOverrides {
        disabled_tools: vec!["edgartools".into()],
        extra_tools: HashMap::new(),
    };

    let merged = merge_configs(&global, Some(&overrides));
    assert!(merged.is_empty(), "Disabled tool should be excluded");
}

#[test]
fn test_mcp_merge_project_adds_custom_tool() {
    let global = GlobalMcpConfig { tools: HashMap::new(), version: 1, updated_at: None };

    let mut extra = HashMap::new();
    extra.insert("custom-mcp".into(), McpToolConfig {
        name: String::new(), // Will be set from key
        command: "node".into(),
        args: vec!["custom-server.js".into()],
        env: HashMap::new(),
        enabled: true,
    });

    let overrides = ProjectMcpOverrides {
        disabled_tools: vec![],
        extra_tools: extra,
    };

    let merged = merge_configs(&global, Some(&overrides));
    assert_eq!(merged.len(), 1);
    assert_eq!(merged[0].name, "custom-mcp");
}

#[test]
fn test_mcp_codex_never_gets_config() {
    // Codex has no MCP support (FR-020). Verify that generate_config_for_cli
    // returns None for codex.
    let tools = vec![McpToolConfig {
        name: "edgartools".into(),
        command: "python3".into(),
        args: vec!["-m".into(), "edgar.ai".into()],
        env: HashMap::new(),
        enabled: true,
    }];

    let result = agentii_vm::cli_config::generate_config_for_cli("codex", &tools);
    // Codex config generator should produce a config.json that does NOT contain
    // MCP server entries (Codex uses its own config format without MCP)
    if let Some((_, content)) = result {
        assert!(!content.contains("edgartools"), "Codex must not get MCP config");
    }
}

// ---------------------------------------------------------------------------
// T063: test_skills_symlink_creation
// ---------------------------------------------------------------------------

#[test]
fn test_skills_dirs_for_claude_and_opencode() {
    // Verify that CLI profiles for Claude Code and OpenCode have skills_dir_path
    let claude = agentii_vm::cli_registry::get_profile("claude");
    assert!(claude.is_some(), "Claude profile must exist");
    let claude_profile = claude.unwrap();
    assert!(
        claude_profile.skills_dir_path.is_some(),
        "Claude Code must have skills_dir_path for symlink creation"
    );

    let opencode = agentii_vm::cli_registry::get_profile("opencode");
    assert!(opencode.is_some(), "OpenCode profile must exist");
    let opencode_profile = opencode.unwrap();
    assert!(
        opencode_profile.skills_dir_path.is_some(),
        "OpenCode must have skills_dir_path for symlink creation"
    );
}

#[test]
fn test_skills_not_for_goose_or_codex() {
    // Goose and Codex use system prompt content for skills, not native dirs
    let goose = agentii_vm::cli_registry::get_profile("goose");
    assert!(goose.is_some(), "Goose profile must exist");
    let goose_profile = goose.unwrap();
    assert!(
        goose_profile.skills_dir_path.is_none(),
        "Goose must NOT have skills_dir_path (uses system prompt instead)"
    );

    let codex = agentii_vm::cli_registry::get_profile("codex");
    assert!(codex.is_some(), "Codex profile must exist");
    let codex_profile = codex.unwrap();
    assert!(
        codex_profile.skills_dir_path.is_none(),
        "Codex must NOT have skills_dir_path (uses system prompt instead)"
    );
}
