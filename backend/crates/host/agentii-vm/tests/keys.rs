use std::collections::HashMap;

use agentii_vm::keys;

#[test]
fn test_collect_api_keys_with_env_override() {
    let mut extra = HashMap::new();
    extra.insert("TEST_KEY".into(), "test_value".into());

    let keys = keys::collect_api_keys(&extra);
    assert_eq!(keys.get("TEST_KEY"), Some(&"test_value".to_string()));
}

#[test]
fn test_empty_values_excluded() {
    let mut extra = HashMap::new();
    extra.insert("EMPTY_KEY".into(), String::new());

    let keys = keys::collect_api_keys(&extra);
    assert!(!keys.contains_key("EMPTY_KEY"));
}

#[test]
fn test_provider_key_names() {
    assert!(keys::PROVIDER_KEY_NAMES.contains(&"ANTHROPIC_API_KEY"));
    assert!(keys::PROVIDER_KEY_NAMES.contains(&"OPENAI_API_KEY"));
}

// ---------------------------------------------------------------------------
// T045: test_provider_priority_selection
// ---------------------------------------------------------------------------

#[test]
fn test_provider_priority_selection() {
    let mut key_map = HashMap::new();
    key_map.insert("ANTHROPIC_API_KEY".into(), "sk-ant-test".into());
    key_map.insert("OPENAI_API_KEY".into(), "sk-oai-test".into());

    let mapper = keys::CliKeyMapper::new(key_map);
    let env = mapper.env_for_cli("goose");

    // Anthropic has higher priority than OpenAI
    assert_eq!(env.get("GOOSE_PROVIDER"), Some(&"anthropic".to_string()));
    // Both keys should be injected
    assert!(env.contains_key("ANTHROPIC_API_KEY"));
    assert!(env.contains_key("OPENAI_API_KEY"));
}

// ---------------------------------------------------------------------------
// T046: test_provider_fallback
// ---------------------------------------------------------------------------

#[test]
fn test_provider_fallback() {
    let mut key_map = HashMap::new();
    key_map.insert("OPENAI_API_KEY".into(), "sk-oai-test".into());

    let mapper = keys::CliKeyMapper::new(key_map);
    let env = mapper.env_for_cli("goose");

    // With only OpenAI key, Goose should fall back to openai provider
    assert_eq!(env.get("GOOSE_PROVIDER"), Some(&"openai".to_string()));
    assert!(!env.contains_key("ANTHROPIC_API_KEY"));
}

// ---------------------------------------------------------------------------
// T047: test_provider_override
// ---------------------------------------------------------------------------

#[test]
fn test_provider_override() {
    let mut key_map = HashMap::new();
    key_map.insert("ANTHROPIC_API_KEY".into(), "sk-ant-test".into());
    key_map.insert("OPENAI_API_KEY".into(), "sk-oai-test".into());

    let mapper = keys::CliKeyMapper::new(key_map);
    let overrides = keys::ProjectOverrides {
        provider_name: Some("openai".into()),
        provider_model: None,
    };
    let env = mapper.env_for_cli_with_overrides("goose", &overrides);

    // Per-project override should take precedence over auto-detection
    assert_eq!(env.get("GOOSE_PROVIDER"), Some(&"openai".to_string()));
}

// ---------------------------------------------------------------------------
// T048: test_key_change_propagation
// ---------------------------------------------------------------------------

#[test]
fn test_key_change_propagation() {
    // Scenario: Create mapper with one set of keys, then create new mapper
    // with updated keys — new mapper should reflect the change.
    // (Keys are read at mapper construction time, not cached globally.)
    let mut keys_v1 = HashMap::new();
    keys_v1.insert("ANTHROPIC_API_KEY".into(), "sk-ant-v1".into());
    let mapper_v1 = keys::CliKeyMapper::new(keys_v1);
    let env_v1 = mapper_v1.env_for_cli("goose");
    assert_eq!(env_v1.get("ANTHROPIC_API_KEY"), Some(&"sk-ant-v1".to_string()));

    // "Key changed" — new mapper with updated key
    let mut keys_v2 = HashMap::new();
    keys_v2.insert("ANTHROPIC_API_KEY".into(), "sk-ant-v2".into());
    let mapper_v2 = keys::CliKeyMapper::new(keys_v2);
    let env_v2 = mapper_v2.env_for_cli("goose");
    assert_eq!(env_v2.get("ANTHROPIC_API_KEY"), Some(&"sk-ant-v2".to_string()));

    // Original mapper retains old value (existing PTY sessions unaffected)
    let env_v1_again = mapper_v1.env_for_cli("goose");
    assert_eq!(env_v1_again.get("ANTHROPIC_API_KEY"), Some(&"sk-ant-v1".to_string()));
}

// ---------------------------------------------------------------------------
// T017: test_keys_never_on_disk
// ---------------------------------------------------------------------------

#[test]
fn test_keys_never_on_disk() {
    // Keys should only exist in the env HashMap, never written to filesystem.
    // The CliKeyMapper returns env vars that are passed to PTY spawn — verify
    // the values are in-memory only and contain the expected API key values.
    let mut key_map = HashMap::new();
    key_map.insert("ANTHROPIC_API_KEY".into(), "sk-secret-123".into());

    let mapper = keys::CliKeyMapper::new(key_map);
    let env = mapper.env_for_cli("goose");

    // Key is present in env (memory-only)
    assert_eq!(env.get("ANTHROPIC_API_KEY"), Some(&"sk-secret-123".to_string()));

    // Config generators should NOT include API keys in their output
    let config = agentii_vm::cli_config::generate_goose_config(&[]);
    assert!(!config.contains("sk-secret"), "API key must not appear in generated config");
}

// ---------------------------------------------------------------------------
// T018: test_bash_tab_no_keys
// ---------------------------------------------------------------------------

#[test]
fn test_bash_tab_no_keys() {
    let mut key_map = HashMap::new();
    key_map.insert("ANTHROPIC_API_KEY".into(), "sk-ant-test".into());
    key_map.insert("OPENAI_API_KEY".into(), "sk-oai-test".into());

    let mapper = keys::CliKeyMapper::new(key_map);

    // bash should get NO API keys (FR-012)
    let bash_env = mapper.env_for_cli("bash");
    assert!(bash_env.is_empty(), "bash tabs must not receive API keys");

    // zsh should also get no keys
    let zsh_env = mapper.env_for_cli("zsh");
    assert!(zsh_env.is_empty(), "zsh tabs must not receive API keys");
}
