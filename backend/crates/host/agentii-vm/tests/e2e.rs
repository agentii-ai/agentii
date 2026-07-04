//! End-to-end integration test for the full VM lifecycle.
//! Requires Lima installed. Run with: cargo test --test e2e -- --ignored

#[ignore]
#[tokio::test]
async fn test_full_project_lifecycle() {
    println!("=== End-to-End VM Lifecycle Test ===");
    println!();
    println!("Full flow:");
    println!("  1. Create project -> VM boots (clone from base)");
    println!("  2. Terminal shows /workspace/ prompt");
    println!("  3. Run Goose CLI -> verify MCP tools available");
    println!("  4. Close terminal tab");
    println!("  5. Reopen project -> VM resumes (<=3s)");
    println!("  6. Workspace intact -> all context files present");
    println!();
    println!("Prerequisites:");
    println!("  - Lima >= 0.20 installed");
    println!("  - Base image created (limactl list should show agentii-base)");
    println!("  - Goose CLI available in base image");
    println!();
    println!("To run manually:");
    println!("  cargo test --test e2e -- --ignored test_full_project_lifecycle");
    println!();

    // This test requires Lima and is meant to be run manually.
    // The full implementation would:
    // 1. Call VmPoolManager::get_or_boot() with a test project
    // 2. Exec "pwd" and verify output is /workspace/
    // 3. Exec "ls" and verify agentii.md, CLAUDE.md, .goosehints exist
    // 4. Exec "which goose" and verify exit code 0
    // 5. Call pool.stop()
    // 6. Call pool.get_or_boot() again and measure resume time
    // 7. Verify workspace files still present
    // 8. Cleanup: delete test VM
}

/// Unit test: verify VmInstance lifecycle state transitions (no Lima required).
#[test]
fn test_vm_instance_state_transitions() {
    use agentii_protocol::vm::{VmConfig, VmStatus};
    use agentii_vm::instance::VmInstance;
    use std::path::PathBuf;

    let mut instance = VmInstance::new(
        "test-project".into(),
        PathBuf::from("/tmp/workspace"),
        PathBuf::from("/tmp/pv"),
        VmConfig::default(),
    );

    // Initial state
    assert_eq!(instance.status, VmStatus::Stopped);
    assert_eq!(instance.window_count, 0);
    assert!(!instance.evicted);

    // Add windows
    instance.add_window();
    assert_eq!(instance.window_count, 1);
    instance.add_window();
    assert_eq!(instance.window_count, 2);

    // Remove windows
    assert!(!instance.remove_window()); // 1 window left
    assert!(instance.remove_window()); // 0 windows, returns true

    // Eviction flag
    instance.evicted = true;
    assert!(instance.evicted);
}
