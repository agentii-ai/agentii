// ---------------------------------------------------------------------------
// T039: test_base_image_all_clis — integration test requiring Lima VM
// T040: test_base_image_disk_size — integration test requiring Lima VM
// ---------------------------------------------------------------------------
//
// These tests require a running Lima VM with the agentii-base image.
// They are gated behind #[ignore] so they only run when explicitly requested:
//   cargo test --test base_image -- --ignored
//
// In CI, these run after the base image provisioning step.

use std::process::Command;

fn lima_available() -> bool {
    Command::new("limactl")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn base_image_running() -> bool {
    let output = Command::new("limactl")
        .args(["list", "--json"])
        .output();
    match output {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout);
            text.contains("agentii-base") && text.contains("Running")
        }
        Err(_) => false,
    }
}

// ---------------------------------------------------------------------------
// T039: test_base_image_all_clis
// ---------------------------------------------------------------------------

#[test]
#[ignore = "Requires running agentii-base Lima VM"]
fn test_base_image_all_clis() {
    if !lima_available() || !base_image_running() {
        eprintln!("SKIP: Lima not available or agentii-base not running");
        return;
    }

    let clis = vec![
        ("goose", "goose --version"),
        ("claude", "claude --version"),
        ("opencode", "opencode --version"),
        ("codex", "codex --version"),
    ];

    let mut failures = Vec::new();

    for (name, cmd) in &clis {
        let output = Command::new("limactl")
            .args(["shell", "agentii-base", "--", "bash", "-c", cmd])
            .output()
            .expect("Failed to execute limactl");

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            failures.push(format!("{name}: {stderr}"));
        }
    }

    assert!(
        failures.is_empty(),
        "CLI detection failures in base image:\n{}",
        failures.join("\n")
    );
}

// ---------------------------------------------------------------------------
// T040: test_base_image_disk_size
// ---------------------------------------------------------------------------

#[test]
#[ignore = "Requires agentii-base Lima VM disk"]
fn test_base_image_disk_size() {
    if !lima_available() {
        eprintln!("SKIP: Lima not available");
        return;
    }

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let disk_path = format!("{home}/.lima/agentii-base/diffdisk");

    // Try diffdisk first, then basedisk
    let path_to_check = if std::path::Path::new(&disk_path).exists() {
        disk_path
    } else {
        let basedisk = format!("{home}/.lima/agentii-base/basedisk");
        if !std::path::Path::new(&basedisk).exists() {
            eprintln!("SKIP: No agentii-base disk found");
            return;
        }
        basedisk
    };

    let output = Command::new("qemu-img")
        .args(["info", "--output=json", &path_to_check])
        .output()
        .expect("qemu-img not installed");

    assert!(output.status.success(), "qemu-img info failed");

    let text = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&text)
        .expect("Failed to parse qemu-img JSON output");

    let actual_size = json.get("actual-size")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let four_gb: u64 = 4 * 1024 * 1024 * 1024;

    assert!(
        actual_size < four_gb,
        "Base image disk too large: {} bytes ({:.1} GB) — target is < 4 GB",
        actual_size,
        actual_size as f64 / (1024.0 * 1024.0 * 1024.0),
    );

    println!(
        "Base image disk size: {:.1} MB (under 4 GB target ✓)",
        actual_size as f64 / (1024.0 * 1024.0)
    );
}
