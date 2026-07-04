//! Export/import round-trip tests.

use agentii_vm::export::{export, import, ExportMetadata};
use tempfile::TempDir;

#[tokio::test]
async fn test_export_import_roundtrip() {
    // Create temp directories for workspace and persistent volume
    let workspace_dir = TempDir::new().unwrap();
    let pv_dir = TempDir::new().unwrap();
    let import_ws_dir = TempDir::new().unwrap();
    let import_pv_dir = TempDir::new().unwrap();

    // Create some test files in workspace
    std::fs::write(workspace_dir.path().join("agentii.md"), "# Test Project\n").unwrap();
    std::fs::create_dir_all(workspace_dir.path().join(".agentii")).unwrap();
    std::fs::write(
        workspace_dir.path().join(".agentii").join("config.toml"),
        "[mcp]\nedgartools.enabled = true\n",
    )
    .unwrap();
    std::fs::write(
        workspace_dir.path().join("analysis.py"),
        "print('hello')\n",
    )
    .unwrap();

    // Create some test files in persistent volume
    std::fs::create_dir_all(pv_dir.path().join(".config").join("goose")).unwrap();
    std::fs::write(
        pv_dir.path().join(".config").join("goose").join("profiles.yaml"),
        "default:\n  provider: anthropic\n",
    )
    .unwrap();

    let metadata = ExportMetadata {
        format_version: 1,
        project_name: "Test Project".into(),
        project_type: "us_stock".into(),
        ticker_symbols: vec!["NVDA".into()],
        base_image_version: "1.0.0".into(),
        exported_at: "2026-03-26T10:00:00Z".into(),
        agentii_version: "0.1.0".into(),
    };

    // Export
    let archive_path = export(
        "Test Project",
        workspace_dir.path(),
        pv_dir.path(),
        metadata.clone(),
    )
    .await
    .unwrap();

    assert!(archive_path.exists(), "Archive should exist");
    assert!(
        archive_path.to_string_lossy().ends_with(".tar.gz"),
        "Should be .tar.gz"
    );

    // Import
    let imported_metadata = import(&archive_path, import_ws_dir.path(), import_pv_dir.path())
        .await
        .unwrap();

    // Verify metadata
    assert_eq!(imported_metadata.project_name, "Test Project");
    assert_eq!(imported_metadata.project_type, "us_stock");
    assert_eq!(imported_metadata.ticker_symbols, vec!["NVDA"]);
    assert_eq!(imported_metadata.base_image_version, "1.0.0");

    // Verify workspace files
    assert!(import_ws_dir.path().join("agentii.md").exists());
    assert!(import_ws_dir.path().join("analysis.py").exists());
    assert!(
        import_ws_dir
            .path()
            .join(".agentii")
            .join("config.toml")
            .exists()
    );

    let content = std::fs::read_to_string(import_ws_dir.path().join("agentii.md")).unwrap();
    assert_eq!(content, "# Test Project\n");

    // Verify persistent volume files
    assert!(
        import_pv_dir
            .path()
            .join(".config")
            .join("goose")
            .join("profiles.yaml")
            .exists()
    );

    // Cleanup export archive
    let _ = std::fs::remove_file(&archive_path);
}

#[tokio::test]
async fn test_export_empty_workspace() {
    let workspace_dir = TempDir::new().unwrap();
    let pv_dir = TempDir::new().unwrap();

    let metadata = ExportMetadata {
        format_version: 1,
        project_name: "Empty".into(),
        project_type: "crypto".into(),
        ticker_symbols: vec!["BTC".into()],
        base_image_version: "1.0.0".into(),
        exported_at: "2026-03-26T10:00:00Z".into(),
        agentii_version: "0.1.0".into(),
    };

    let archive_path = export("Empty", workspace_dir.path(), pv_dir.path(), metadata)
        .await
        .unwrap();

    assert!(archive_path.exists());

    // Import into fresh dirs
    let import_ws = TempDir::new().unwrap();
    let import_pv = TempDir::new().unwrap();
    let imported = import(&archive_path, import_ws.path(), import_pv.path())
        .await
        .unwrap();
    assert_eq!(imported.project_name, "Empty");

    let _ = std::fs::remove_file(&archive_path);
}
