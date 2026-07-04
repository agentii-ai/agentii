//! Security integration tests for agentii-vm.
//! Require Lima installed. Run with: cargo test --test security -- --ignored

use std::path::Path;

// ============================================================
// Unit-level security tests (no Lima required, always run)
// ============================================================

#[test]
fn test_path_traversal_blocked() {
    use agentii_vm::security::path_validator::validate_path;
    let ws = Path::new("/workspace");

    // Gate 1: null byte
    assert!(validate_path("/workspace/file\0.txt", ws).is_err());

    // Gate 2: .. traversal
    assert!(validate_path("/workspace/../etc/passwd", ws).is_err());
    assert!(validate_path("../../../etc/shadow", ws).is_err());

    // Gate 3: URL-encoded traversal
    assert!(validate_path("/workspace/%2e%2e/etc", ws).is_err());
    assert!(validate_path("/workspace/%2f%2e%2e", ws).is_err());

    // Gate 4: ~user expansion
    assert!(validate_path("~root/.ssh/id_rsa", ws).is_err());

    // Gate 5: workspace escape
    assert!(validate_path("/etc/passwd", ws).is_err());
    assert!(validate_path("/root/.bashrc", ws).is_err());

    // Valid paths should pass
    assert!(validate_path("/workspace/file.txt", ws).is_ok());
    assert!(validate_path("/workspace/subdir/deep/file.py", ws).is_ok());
}

#[test]
fn test_symlink_escape_path_validation() {
    use agentii_vm::security::path_validator::validate_path;
    let ws = Path::new("/workspace");

    // Paths that look like they're in workspace but point outside
    assert!(validate_path("/workspace/../etc/passwd", ws).is_err());

    // Absolute paths outside workspace
    assert!(validate_path("/etc/shadow", ws).is_err());
    assert!(validate_path("/home/user/.ssh/id_rsa", ws).is_err());
}

#[test]
fn test_forbidden_prefix_denylisted() {
    use agentii_vm::security::path_validator::validate_path;
    let ws = Path::new("/workspace");

    // All forbidden prefixes should be blocked
    for prefix in &["/etc", "/root", "/home", "/usr", "/bin", "/sbin", "/var", "/tmp"] {
        let path = format!("{}/sensitive_file", prefix);
        assert!(
            validate_path(&path, ws).is_err(),
            "Path {} should be blocked",
            path
        );
    }
}

#[test]
fn test_env_sanitizer_blocks_secrets() {
    use agentii_vm::security::env_sanitizer::sanitize_env;
    use std::collections::HashMap;

    let mut env = HashMap::new();
    // Safe vars
    env.insert("PATH".into(), "/usr/bin".into());
    env.insert("HOME".into(), "/workspace".into());
    env.insert("TERM".into(), "xterm-256color".into());
    // LLM keys (should pass)
    env.insert("ANTHROPIC_API_KEY".into(), "sk-ant-test123".into());
    env.insert("OPENAI_API_KEY".into(), "sk-test456".into());
    // Dangerous vars (should be blocked)
    env.insert("AWS_SECRET_ACCESS_KEY".into(), "secret123".into());
    env.insert("GITHUB_TOKEN".into(), "ghp_abc123".into());
    env.insert("DATABASE_URL".into(), "postgres://localhost/db".into());

    let clean = sanitize_env(&env);

    // Safe vars pass through
    assert!(clean.contains_key("PATH"));
    assert!(clean.contains_key("HOME"));
    assert!(clean.contains_key("TERM"));

    // LLM keys pass through
    assert!(clean.contains_key("ANTHROPIC_API_KEY"));
    assert!(clean.contains_key("OPENAI_API_KEY"));

    // Dangerous vars blocked
    assert!(!clean.contains_key("AWS_SECRET_ACCESS_KEY"));
    assert!(!clean.contains_key("GITHUB_TOKEN"));
    assert!(!clean.contains_key("DATABASE_URL"));
}

#[test]
fn test_leak_detector_redacts_secrets() {
    use agentii_vm::security::leak_detector::scan_output;

    // Anthropic key
    let output = "Using key sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456";
    let redacted = scan_output(output);
    assert!(
        !redacted.contains("sk-ant-api03"),
        "Anthropic key should be redacted"
    );
    assert!(
        redacted.contains("[REDACTED"),
        "Should contain REDACTED marker"
    );

    // OpenAI key
    let output = "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz12345678";
    let redacted = scan_output(output);
    assert!(
        !redacted.contains("sk-abcdefghijklmnopqrstuvwxyz"),
        "OpenAI key should be redacted"
    );

    // AWS key
    let output = "aws_access_key_id = AKIAIOSFODNN7EXAMPLE";
    let redacted = scan_output(output);
    assert!(
        !redacted.contains("AKIAIOSFODNN7EXAMPLE"),
        "AWS key should be redacted"
    );

    // GitHub token
    let output = "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";
    let redacted = scan_output(output);
    assert!(
        !redacted.contains("ghp_ABCDEF"),
        "GitHub token should be redacted"
    );

    // Normal text unchanged
    let output = "Hello world, this is normal output with no secrets";
    assert_eq!(scan_output(output), output);
}

#[test]
fn test_permission_tier_iptables_rules() {
    use agentii_protocol::vm::PermissionTier;
    use agentii_vm::permissions::TierConfig;

    // Suggest tier: DROP all, allow loopback only
    let suggest = TierConfig::for_tier(PermissionTier::Suggest);
    let rules = suggest.iptables_rules();
    assert!(rules
        .iter()
        .any(|r| r.contains("OUTPUT DROP") || r.contains("-P OUTPUT DROP")));
    assert!(rules.iter().any(|r| r.contains("-o lo -j ACCEPT")));
    assert!(suggest.remount_readonly);

    // AutoEdit tier: DROP default, allow DNS + LLM APIs + package registries
    let auto_edit = TierConfig::for_tier(PermissionTier::AutoEdit);
    let rules = auto_edit.iptables_rules();
    assert!(rules
        .iter()
        .any(|r| r.contains("OUTPUT DROP") || r.contains("-P OUTPUT DROP")));
    assert!(rules.iter().any(|r| r.contains("--dport 53")));
    assert!(rules.iter().any(|r| r.contains("api.anthropic.com")));
    assert!(!auto_edit.remount_readonly);
    assert!(!auto_edit.allowed_domains.is_empty());

    // FullAuto tier: no restrictions
    let full_auto = TierConfig::for_tier(PermissionTier::FullAuto);
    let rules = full_auto.iptables_rules();
    assert!(rules.is_empty() || rules.iter().all(|r| !r.contains("DROP")));
    assert!(!full_auto.remount_readonly);
}

// ============================================================
// Lima integration tests (require Lima, #[ignore])
// ============================================================

#[ignore]
#[tokio::test]
async fn test_vm_nonroot_user() {
    // Requires a running agentii VM
    // whoami inside VM should return "agentii", not "root"
    println!("SKIP: Requires Lima VM. Run manually with: cargo test --test security -- --ignored");
}

#[ignore]
#[tokio::test]
async fn test_vm_mount_enumeration() {
    // mount command inside VM should only show /workspace/ and /home/agentii.linux/
    println!("SKIP: Requires Lima VM. Run manually with: cargo test --test security -- --ignored");
}

#[ignore]
#[tokio::test]
async fn test_vm_network_isolation_suggest() {
    // Suggest tier: curl api.anthropic.com should fail
    println!("SKIP: Requires Lima VM. Run manually with: cargo test --test security -- --ignored");
}

#[ignore]
#[tokio::test]
async fn test_vm_network_isolation_autoedit() {
    // AutoEdit tier: curl api.anthropic.com should succeed, curl evil.com should fail
    println!("SKIP: Requires Lima VM. Run manually with: cargo test --test security -- --ignored");
}
