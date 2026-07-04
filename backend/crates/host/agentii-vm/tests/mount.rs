use agentii_vm::mount::{PersistentVolume, WorkspaceMount};
use std::path::PathBuf;

#[test]
fn test_workspace_mount_config() {
    let mount = WorkspaceMount::new(PathBuf::from("/Users/frank/my-project"), true);
    assert_eq!(mount.vm_path, "/workspace");
    assert!(mount.writable);
    assert_eq!(
        mount.to_lima_mount_arg(),
        "/Users/frank/my-project:/workspace"
    );
}

#[test]
fn test_workspace_mount_readonly() {
    let mount = WorkspaceMount::new(PathBuf::from("/tmp/readonly"), false);
    assert!(!mount.writable);
}

#[tokio::test]
async fn test_persistent_volume_create() {
    let tmp = tempfile::tempdir().unwrap();
    let pv = PersistentVolume::new(tmp.path().join("test-pv"));
    pv.ensure_exists().await.unwrap();
    assert!(tmp.path().join("test-pv").exists());
}
