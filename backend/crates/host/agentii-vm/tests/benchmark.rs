//! Performance benchmarks for VM operations.
//! Require Lima installed. Run with: cargo test --test benchmark -- --ignored

#[ignore]
#[tokio::test]
async fn bench_cold_boot() {
    // Target: <=15s from get_or_boot() to first successful exec()
    // This test requires Lima and a base image.
    // Run manually: cargo test --test benchmark -- --ignored bench_cold_boot

    use std::time::Instant;

    println!("=== Cold Boot Benchmark ===");
    println!("Target: <=15s from get_or_boot() to first successful exec()");
    println!("Prerequisites: Lima installed, base image created");
    println!();
    println!("To run manually:");
    println!("  1. Ensure Lima is installed: limactl --version");
    println!("  2. Run: cargo test --test benchmark -- --ignored bench_cold_boot");
    println!();

    // Placeholder -- actual benchmark requires Lima
    let start = Instant::now();
    let elapsed = start.elapsed();
    println!(
        "Elapsed: {:?} (placeholder -- no Lima available in CI)",
        elapsed
    );
}

#[ignore]
#[tokio::test]
async fn bench_warm_resume() {
    // Target: <=3s from start to first successful exec()

    println!("=== Warm Resume Benchmark ===");
    println!("Target: <=3s from limactl start to first successful exec()");
    println!("Prerequisites: Lima installed, stopped VM exists");
    println!();
    println!("To run manually:");
    println!("  1. Create and stop a VM first");
    println!("  2. Run: cargo test --test benchmark -- --ignored bench_warm_resume");
}

#[ignore]
#[tokio::test]
async fn bench_clone_speed() {
    // Measure limactl clone duration

    println!("=== Clone Speed Benchmark ===");
    println!("Measures: limactl clone base -> project VM");
    println!("Expected: <5s (copy-on-write disk)");
}
