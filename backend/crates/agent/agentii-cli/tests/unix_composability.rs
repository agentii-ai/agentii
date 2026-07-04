use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

// ---------------------------------------------------------------------------
// T089: Unix composability tests
// ---------------------------------------------------------------------------

#[test]
fn version_flag_works() {
    let root = unique_temp_dir("version-flag");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(&root, &["--version"], &[]);
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(
        stdout.contains(env!("CARGO_PKG_VERSION")),
        "expected version string in stdout, got: {stdout}"
    );
}

#[test]
fn help_flag_works() {
    let root = unique_temp_dir("help-flag");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(&root, &["--help"], &[]);
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    assert!(
        stdout.contains("Usage"),
        "expected Usage in help output, got: {stdout}"
    );
}

#[test]
fn output_format_jsonl_flag_produces_valid_jsonl() {
    let root = unique_temp_dir("format-jsonl");
    fs::create_dir_all(&root).expect("temp dir should exist");

    // Use the version command with --output-format jsonl — it is a local-only
    // command that does not require API access and emits structured output.
    // Non-prompt commands emit a single JSON object (possibly pretty-printed);
    // prompt commands emit one compact JSON object per line.
    let output = run_agentii(&root, &["--output-format", "jsonl", "version"], &[]);
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    // The entire stdout must be parseable as at least one JSON value.
    assert!(
        !stdout.trim().is_empty(),
        "expected non-empty output for --output-format jsonl"
    );
    // Parse the whole output as a JSON value (handles both compact and pretty).
    let parsed: Result<Value, _> = serde_json::from_str(stdout.trim());
    assert!(
        parsed.is_ok(),
        "stdout should be valid JSON for --output-format jsonl, got:\n{stdout}"
    );
    let value = parsed.unwrap();
    assert_eq!(value["kind"], "version");
}

#[test]
fn output_format_json_flag_produces_valid_json() {
    let root = unique_temp_dir("format-json");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(&root, &["--output-format", "json", "version"], &[]);
    assert_success(&output);
    let parsed: Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be valid JSON");
    assert_eq!(parsed["kind"], "version");
    assert_eq!(parsed["version"], env!("CARGO_PKG_VERSION"));
}

#[test]
fn output_format_text_flag_produces_text_output() {
    let root = unique_temp_dir("format-text");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(&root, &["--output-format", "text", "version"], &[]);
    assert_success(&output);
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    // Text output should contain the version string but NOT be JSON.
    assert!(
        stdout.contains(env!("CARGO_PKG_VERSION")),
        "expected version string in text output, got: {stdout}"
    );
    // Should not be a JSON object at the top level.
    assert!(
        serde_json::from_str::<Value>(&stdout).is_err(),
        "text output should not be valid JSON, got: {stdout}"
    );
}

#[test]
fn format_alias_flag_is_equivalent_to_output_format() {
    let root = unique_temp_dir("format-alias");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let via_output_format = run_agentii(&root, &["--output-format", "json", "version"], &[]);
    let via_format = run_agentii(&root, &["--format", "json", "version"], &[]);

    assert_success(&via_output_format);
    assert_success(&via_format);

    let parsed_a: Value =
        serde_json::from_slice(&via_output_format.stdout).expect("output-format stdout is JSON");
    let parsed_b: Value =
        serde_json::from_slice(&via_format.stdout).expect("format stdout is JSON");

    assert_eq!(parsed_a["kind"], parsed_b["kind"]);
    assert_eq!(parsed_a["version"], parsed_b["version"]);
}

#[test]
fn tier_suggest_maps_to_read_only_permission_mode() {
    let root = unique_temp_dir("tier-suggest");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(
        &root,
        &["--tier", "suggest", "--output-format", "json", "status"],
        &[],
    );
    assert_success(&output);
    let parsed: Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be valid JSON");
    assert_eq!(
        parsed["permission_mode"], "read-only",
        "tier=suggest should map to read-only, got: {}",
        parsed["permission_mode"]
    );
}

#[test]
fn tier_auto_edit_maps_to_workspace_write_permission_mode() {
    let root = unique_temp_dir("tier-auto-edit");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(
        &root,
        &["--tier", "auto-edit", "--output-format", "json", "status"],
        &[],
    );
    assert_success(&output);
    let parsed: Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be valid JSON");
    assert_eq!(
        parsed["permission_mode"], "workspace-write",
        "tier=auto-edit should map to workspace-write, got: {}",
        parsed["permission_mode"]
    );
}

#[test]
fn tier_full_auto_maps_to_danger_full_access_permission_mode() {
    let root = unique_temp_dir("tier-full-auto");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(
        &root,
        &[
            "--tier",
            "full-auto",
            "--output-format",
            "json",
            "status",
        ],
        &[],
    );
    assert_success(&output);
    let parsed: Value =
        serde_json::from_slice(&output.stdout).expect("stdout should be valid JSON");
    assert_eq!(
        parsed["permission_mode"], "danger-full-access",
        "tier=full-auto should map to danger-full-access, got: {}",
        parsed["permission_mode"]
    );
}

#[test]
fn tier_flag_rejects_unknown_values() {
    let root = unique_temp_dir("tier-unknown");
    fs::create_dir_all(&root).expect("temp dir should exist");

    let output = run_agentii(&root, &["--tier", "turbo-mode", "status"], &[]);
    assert!(
        !output.status.success(),
        "unknown tier should fail, stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    assert!(
        stderr.contains("turbo-mode"),
        "error message should mention the bad value, got: {stderr}"
    );
}

#[test]
fn stdout_and_stderr_are_separated_for_json_output() {
    let root = unique_temp_dir("stdout-stderr-sep");
    fs::create_dir_all(&root).expect("temp dir should exist");

    // doctor writes structured output to stdout; any warnings go to stderr.
    let output = run_agentii(&root, &["--output-format", "json", "doctor"], &[]);
    // doctor may exit non-zero if checks fail, but stdout must still be JSON.
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf8");
    let parsed: Result<Value, _> = serde_json::from_str(stdout.trim());
    assert!(
        parsed.is_ok(),
        "stdout should be valid JSON even when doctor has failures, got: {stdout}"
    );
    // stderr must not contain JSON (it should be human-readable log lines or empty).
    let stderr = String::from_utf8(output.stderr).expect("stderr should be utf8");
    if !stderr.trim().is_empty() {
        let stderr_is_json: bool = serde_json::from_str::<Value>(stderr.trim()).is_ok();
        assert!(
            !stderr_is_json,
            "stderr should not be JSON when stdout carries structured output, got: {stderr}"
        );
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn run_agentii(current_dir: &Path, args: &[&str], envs: &[(&str, &str)]) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_agentii"));
    command.current_dir(current_dir).args(args);
    for (key, value) in envs {
        command.env(key, value);
    }
    command.output().expect("agentii binary should launch")
}

fn assert_success(output: &Output) {
    assert!(
        output.status.success(),
        "stdout:\n{}\n\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}

fn unique_temp_dir(label: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock should be after epoch")
        .as_millis();
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "agentii-unix-composability-{label}-{}-{millis}-{counter}",
        std::process::id()
    ))
}
