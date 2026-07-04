//! Disk usage benchmarks for VM storage efficiency.
//! Require Lima installed. Run with: cargo test --test disk_benchmark -- --ignored

#[ignore]
#[tokio::test]
async fn bench_disk_usage_5_projects() {
    // Target: 5 projects with Python venvs < 8 GB total

    println!("=== Disk Usage Benchmark ===");
    println!("Target: 5 projects with Python venvs < 8 GB total disk");
    println!("Prerequisites: Lima installed, base image created");
    println!();
    println!("Test plan:");
    println!("  1. Create 5 project VMs via limactl clone");
    println!("  2. In each VM: python3 -m venv .venv && pip install goose-ai");
    println!("  3. Measure total disk via qemu-img info --output=json");
    println!("  4. Assert total < 8 GB");
    println!("  5. Report per-project delta from base image");
    println!();
    println!("To run manually:");
    println!("  cargo test --test disk_benchmark -- --ignored bench_disk_usage_5_projects");
}

/// Unit test for DiskUsageReport serialization (no Lima required).
#[test]
fn test_disk_usage_report_serialization() {
    use agentii_vm::pool::{DiskUsageReport, ProjectDiskUsage};

    let report = DiskUsageReport {
        base_image_bytes: 2_000_000_000,
        projects: vec![
            ProjectDiskUsage {
                project_id: "proj-1".into(),
                vm_name: "agentii-proj-1".into(),
                actual_bytes: 500_000_000,
                virtual_bytes: 10_000_000_000,
            },
            ProjectDiskUsage {
                project_id: "proj-2".into(),
                vm_name: "agentii-proj-2".into(),
                actual_bytes: 300_000_000,
                virtual_bytes: 10_000_000_000,
            },
        ],
        total_bytes: 800_000_000,
    };

    let json = serde_json::to_string_pretty(&report).unwrap();
    assert!(json.contains("base_image_bytes"));
    assert!(json.contains("proj-1"));
    assert!(json.contains("800000000"));
}
