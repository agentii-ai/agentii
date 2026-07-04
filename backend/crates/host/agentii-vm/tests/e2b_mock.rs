//! Mock E2B backend test — validates that the full workspace provisioning
//! sequence works through VmBackendTrait without any Lima-specific code.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::Mutex;

use agentii_protocol::vm::{PermissionTier, VmStatus};
use agentii_vm::backend::{
    BackendCapabilities, VmBackendTrait, VmBootOptions, VmError, VmExecOptions, VmExecOutput,
    VmResult,
};

/// Mock E2B backend with in-memory state.
struct MockE2BBackend {
    vms: Mutex<HashMap<String, VmStatus>>,
    exec_log: Arc<Mutex<Vec<String>>>,
}

impl MockE2BBackend {
    fn new() -> Self {
        Self {
            vms: Mutex::new(HashMap::new()),
            exec_log: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[async_trait]
impl VmBackendTrait for MockE2BBackend {
    async fn boot(&self, options: &VmBootOptions) -> VmResult<()> {
        let mut vms = self.vms.lock().await;
        vms.insert(options.vm_name.clone(), VmStatus::Running);
        Ok(())
    }

    async fn stop(&self, vm_name: &str) -> VmResult<()> {
        let mut vms = self.vms.lock().await;
        if let Some(status) = vms.get_mut(vm_name) {
            *status = VmStatus::Stopped;
            Ok(())
        } else {
            Err(VmError::NotFound(vm_name.to_string()))
        }
    }

    async fn status(&self, vm_name: &str) -> VmResult<VmStatus> {
        let vms = self.vms.lock().await;
        vms.get(vm_name)
            .copied()
            .ok_or_else(|| VmError::NotFound(vm_name.to_string()))
    }

    async fn exec(&self, options: &VmExecOptions) -> VmResult<VmExecOutput> {
        let vms = self.vms.lock().await;
        if !vms.contains_key(&options.vm_name) {
            return Err(VmError::NotFound(options.vm_name.clone()));
        }
        drop(vms);

        let mut log = self.exec_log.lock().await;
        log.push(format!("{} {}", options.command, options.args.join(" ")));

        Ok(VmExecOutput {
            stdout: String::new(),
            stderr: String::new(),
            exit_code: 0,
        })
    }

    async fn mount_workspace(
        &self,
        vm_name: &str,
        _host_path: &PathBuf,
        _vm_path: &str,
    ) -> VmResult<()> {
        let vms = self.vms.lock().await;
        if vms.contains_key(vm_name) {
            Ok(())
        } else {
            Err(VmError::NotFound(vm_name.to_string()))
        }
    }

    async fn delete(&self, vm_name: &str) -> VmResult<()> {
        let mut vms = self.vms.lock().await;
        vms.remove(vm_name);
        Ok(())
    }

    async fn is_available(&self) -> bool {
        true
    }

    fn name(&self) -> &str {
        "mock-e2b"
    }

    fn capabilities(&self) -> BackendCapabilities {
        BackendCapabilities {
            supports_clone: false,
            supports_snapshot: true,
            supports_virtiofs: false,
            supports_resize: true,
        }
    }
}

#[tokio::test]
async fn test_full_provisioning_sequence() {
    let backend = MockE2BBackend::new();

    // Boot
    let boot_opts = VmBootOptions {
        vm_name: "test-e2b-vm".into(),
        workspace_path: PathBuf::from("/tmp/test-workspace"),
        permission_tier: PermissionTier::AutoEdit,
        ram_mb: 2048,
        cpus: 2,
        env: HashMap::new(),
        persistent_volume_path: Some(PathBuf::from("/tmp/test-pv")),
        guest_workspace_path: "/workspace".into(),
        guest_pv_path: "/home/agentii.linux".into(),
        base_image_name: "e2b-base".into(),
    };

    backend.boot(&boot_opts).await.unwrap();

    // Verify running
    let status = backend.status("test-e2b-vm").await.unwrap();
    assert_eq!(status, VmStatus::Running);

    // Mount workspace (no-op for E2B, but must succeed)
    backend
        .mount_workspace(
            "test-e2b-vm",
            &PathBuf::from("/tmp/test-workspace"),
            "/workspace",
        )
        .await
        .unwrap();

    // Exec: context-gen
    backend
        .exec(&VmExecOptions {
            vm_name: "test-e2b-vm".into(),
            command: "agentii-context-gen".into(),
            args: vec!["--workspace".into(), "/workspace".into()],
            env: HashMap::new(),
            cwd: Some("/workspace".into()),
        })
        .await
        .unwrap();

    // Exec: MCP provision
    backend
        .exec(&VmExecOptions {
            vm_name: "test-e2b-vm".into(),
            command: "bash".into(),
            args: vec!["-c".into(), "provision-mcp".into()],
            env: HashMap::new(),
            cwd: None,
        })
        .await
        .unwrap();

    // Exec: skills copy
    backend
        .exec(&VmExecOptions {
            vm_name: "test-e2b-vm".into(),
            command: "bash".into(),
            args: vec!["-c".into(), "copy-skills".into()],
            env: HashMap::new(),
            cwd: None,
        })
        .await
        .unwrap();

    // Stop
    backend.stop("test-e2b-vm").await.unwrap();
    let status = backend.status("test-e2b-vm").await.unwrap();
    assert_eq!(status, VmStatus::Stopped);

    // Delete
    backend.delete("test-e2b-vm").await.unwrap();
    assert!(backend.status("test-e2b-vm").await.is_err());

    // Verify exec log
    let log = backend.exec_log.lock().await;
    assert_eq!(log.len(), 3);
    assert!(log[0].contains("context-gen"));
    assert!(log[1].contains("provision-mcp"));
    assert!(log[2].contains("copy-skills"));
}

#[tokio::test]
async fn test_capabilities_report() {
    let backend = MockE2BBackend::new();
    let caps = backend.capabilities();
    assert!(!caps.supports_clone);
    assert!(caps.supports_snapshot);
    assert!(!caps.supports_virtiofs);
    assert!(caps.supports_resize);
}

#[tokio::test]
async fn test_exec_on_nonexistent_vm_fails() {
    let backend = MockE2BBackend::new();
    let result = backend
        .exec(&VmExecOptions {
            vm_name: "ghost-vm".into(),
            command: "echo".into(),
            args: vec!["hello".into()],
            env: HashMap::new(),
            cwd: None,
        })
        .await;
    assert!(result.is_err());
}
