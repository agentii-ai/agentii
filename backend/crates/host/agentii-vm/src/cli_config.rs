//! CLI-specific first-run configuration generation.
//!
//! Generates config files that bypass onboarding wizards and configure MCP tools
//! for each supported CLI agent. Re-provisioned at every PTY spawn (self-healing).

use crate::mcp_config::McpToolConfig;

// ---------------------------------------------------------------------------
// T019: Goose config.yaml generation
// ---------------------------------------------------------------------------

/// Generate Goose `~/.config/goose/config.yaml` content.
///
/// Includes: MCP extensions, GOOSE_MODE: auto, telemetry opt-out.
/// Does NOT include: provider, model (those come from env vars).
pub fn generate_goose_config(mcp_tools: &[McpToolConfig]) -> String {
    let mut yaml = String::from("GOOSE_MODE: auto\ntelemetry:\n  enabled: false\n");

    if !mcp_tools.is_empty() {
        yaml.push_str("extensions:\n");
        for tool in mcp_tools {
            yaml.push_str(&format!("  {}:\n", tool.name));
            yaml.push_str("    type: stdio\n");
            yaml.push_str(&format!("    command: {}\n", tool.command));
            if !tool.args.is_empty() {
                yaml.push_str("    args:\n");
                for arg in &tool.args {
                    yaml.push_str(&format!("      - \"{}\"\n", arg));
                }
            }
            if !tool.env.is_empty() {
                yaml.push_str("    env:\n");
                for (k, v) in &tool.env {
                    yaml.push_str(&format!("      {}: \"{}\"\n", k, v));
                }
            }
            yaml.push_str("    enabled: true\n");
        }
    }

    yaml
}

// ---------------------------------------------------------------------------
// T033: Claude Code settings.json generation
// ---------------------------------------------------------------------------

/// Generate Claude Code `~/.claude/settings.json` content.
///
/// Includes: acceptedTerms, mcpServers.
pub fn generate_claude_config(mcp_tools: &[McpToolConfig]) -> String {
    let mut servers = serde_json::Map::new();
    for tool in mcp_tools {
        let mut entry = serde_json::Map::new();
        entry.insert("command".into(), serde_json::Value::String(tool.command.clone()));
        entry.insert(
            "args".into(),
            serde_json::Value::Array(tool.args.iter().map(|a| serde_json::Value::String(a.clone())).collect()),
        );
        if !tool.env.is_empty() {
            let env_obj: serde_json::Map<String, serde_json::Value> = tool.env.iter()
                .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                .collect();
            entry.insert("env".into(), serde_json::Value::Object(env_obj));
        }
        servers.insert(tool.name.clone(), serde_json::Value::Object(entry));
    }

    let config = serde_json::json!({
        "acceptedTerms": true,
        "mcpServers": servers,
    });

    serde_json::to_string_pretty(&config).unwrap_or_else(|_| r#"{"acceptedTerms":true}"#.into())
}

// ---------------------------------------------------------------------------
// T034: OpenCode config.toml generation
// ---------------------------------------------------------------------------

/// Generate OpenCode `~/.config/opencode/config.toml` content.
///
/// Includes: onboarding_complete, MCP servers.
pub fn generate_opencode_config(mcp_tools: &[McpToolConfig]) -> String {
    let mut toml = String::from("[general]\nonboarding_complete = true\n");

    for tool in mcp_tools {
        toml.push_str(&format!("\n[mcp.{}]\n", tool.name));
        toml.push_str(&format!("command = \"{}\"\n", tool.command));
        if !tool.args.is_empty() {
            let args_str: Vec<String> = tool.args.iter().map(|a| format!("\"{}\"", a)).collect();
            toml.push_str(&format!("args = [{}]\n", args_str.join(", ")));
        }
        if !tool.env.is_empty() {
            toml.push_str(&format!("\n[mcp.{}.env]\n", tool.name));
            for (k, v) in &tool.env {
                toml.push_str(&format!("{} = \"{}\"\n", k, v));
            }
        }
    }

    toml
}

// ---------------------------------------------------------------------------
// T035: Codex config.json generation
// ---------------------------------------------------------------------------

/// Generate Codex `~/.codex/config.json` content.
///
/// Includes: onboardingComplete only. No MCP (Codex doesn't support it).
pub fn generate_codex_config() -> String {
    serde_json::to_string_pretty(&serde_json::json!({
        "onboardingComplete": true,
    }))
    .unwrap_or_else(|_| r#"{"onboardingComplete":true}"#.into())
}

/// Generate the appropriate config content for a given CLI ID.
pub fn generate_config_for_cli(cli_id: &str, mcp_tools: &[McpToolConfig]) -> Option<(String, String)> {
    match cli_id {
        "goose" => Some((
            "~/.config/goose/config.yaml".into(),
            generate_goose_config(mcp_tools),
        )),
        "claude" => Some((
            "/workspace/.claude/settings.json".into(),
            generate_claude_config(mcp_tools),
        )),
        "opencode" => Some((
            "~/.config/opencode/config.toml".into(),
            generate_opencode_config(mcp_tools),
        )),
        "codex" => Some((
            "~/.codex/config.json".into(),
            generate_codex_config(),
        )),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // T014: test_goose_config_generation
    #[test]
    fn test_goose_config_generation() {
        let tools = vec![
            McpToolConfig {
                name: "edgartools".into(),
                command: "python3".into(),
                args: vec!["-m".into(), "edgar.ai".into()],
                env: Default::default(),
                enabled: true,
            },
            McpToolConfig {
                name: "custom-tool".into(),
                command: "node".into(),
                args: vec!["server.js".into()],
                env: Default::default(),
                enabled: true,
            },
        ];

        let config = generate_goose_config(&tools);

        // Verify YAML contains required fields
        assert!(config.contains("GOOSE_MODE: auto"), "Missing GOOSE_MODE");
        assert!(config.contains("telemetry:"), "Missing telemetry section");
        assert!(config.contains("enabled: false"), "Telemetry should be disabled");
        assert!(config.contains("extensions:"), "Missing extensions section");
        assert!(config.contains("edgartools:"), "Missing edgartools extension");
        assert!(config.contains("custom-tool:"), "Missing custom-tool extension");

        // Verify no provider/model keys
        assert!(!config.contains("provider:"), "Config should NOT contain provider key");
        assert!(!config.contains("model:"), "Config should NOT contain model key");
    }

    // T030: test_claude_config_generation
    #[test]
    fn test_claude_config_generation() {
        let tools = vec![
            McpToolConfig {
                name: "edgartools".into(),
                command: "python3".into(),
                args: vec!["-m".into(), "edgar.ai".into()],
                env: Default::default(),
                enabled: true,
            },
            McpToolConfig {
                name: "custom-tool".into(),
                command: "node".into(),
                args: vec!["server.js".into()],
                env: Default::default(),
                enabled: true,
            },
        ];

        let config = generate_claude_config(&tools);
        let parsed: serde_json::Value = serde_json::from_str(&config).expect("Invalid JSON");

        assert_eq!(parsed["acceptedTerms"], true);
        assert!(parsed["mcpServers"].is_object());
        assert!(parsed["mcpServers"]["edgartools"].is_object());
        assert!(parsed["mcpServers"]["custom-tool"].is_object());

        // No raw API keys in file
        assert!(!config.contains("sk-ant-"), "Config should NOT contain API keys");
    }

    // T031: test_opencode_config_generation
    #[test]
    fn test_opencode_config_generation() {
        let tools = vec![
            McpToolConfig {
                name: "edgartools".into(),
                command: "python3".into(),
                args: vec!["-m".into(), "edgar.ai".into()],
                env: Default::default(),
                enabled: true,
            },
            McpToolConfig {
                name: "custom-tool".into(),
                command: "node".into(),
                args: vec!["server.js".into()],
                env: Default::default(),
                enabled: true,
            },
        ];

        let config = generate_opencode_config(&tools);

        assert!(config.contains("onboarding_complete = true"), "Missing onboarding_complete");
        assert!(config.contains("[mcp.edgartools]"), "Missing edgartools MCP section");
        assert!(config.contains("[mcp.custom-tool]"), "Missing custom-tool MCP section");
    }

    // T032: test_codex_config_generation
    #[test]
    fn test_codex_config_generation() {
        let config = generate_codex_config();
        let parsed: serde_json::Value = serde_json::from_str(&config).expect("Invalid JSON");

        assert_eq!(parsed["onboardingComplete"], true);

        // Codex should NOT have mcpServers
        assert!(parsed.get("mcpServers").is_none(), "Codex should NOT have mcpServers");
    }

    #[test]
    fn test_generate_config_for_cli_paths() {
        let tools = vec![];

        let (path, _) = generate_config_for_cli("claude", &tools).unwrap();
        assert_eq!(path, "/workspace/.claude/settings.json", "Claude config must use project-level path");

        let (path, _) = generate_config_for_cli("goose", &tools).unwrap();
        assert_eq!(path, "~/.config/goose/config.yaml");

        let (path, _) = generate_config_for_cli("opencode", &tools).unwrap();
        assert_eq!(path, "~/.config/opencode/config.toml");

        let (path, _) = generate_config_for_cli("codex", &tools).unwrap();
        assert_eq!(path, "~/.codex/config.json");

        assert!(generate_config_for_cli("unknown", &tools).is_none());
    }
}
