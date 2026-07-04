use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use agentii_protocol::vm::{PermissionTier, VmConfig, VmStatus};
use agentii_vm::backend::{VmBackendTrait, VmBootOptions, VmError, VmExecOptions, VmExecOutput, VmResult};
use agentii_vm::pool::VmPoolManager;
use async_trait::async_trait;
use tokio::sync::Mutex;

/// Mock VM backend for testing.
struct MockBackend {
    vms: Mutex<HashMap<String, VmStatus>>,
}

impl MockBackend {
    fn new() -> Self {
        Self {
            vms: Mutex::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl VmBackendTrait for MockBackend {
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
            Err(VmError::NotFound(vm_name.into()))
        }
    }

    async fn status(&self, vm_name: &str) -> VmResult<VmStatus> {
        let vms = self.vms.lock().await;
        vms.get(vm_name)
            .copied()
            .ok_or_else(|| VmError::NotFound(vm_name.into()))
    }

    async fn exec(&self, _options: &VmExecOptions) -> VmResult<VmExecOutput> {
        Ok(VmExecOutput {
            stdout: String::new(),
            stderr: String::new(),
            exit_code: 0,
        })
    }

    async fn mount_workspace(&self, _vm_name: &str, _host_path: &PathBuf, _vm_path: &str) -> VmResult<()> {
        Ok(())
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
        "mock"
    }
}

#[tokio::test]
async fn test_vm_boot_and_stop() {
    let backend = Arc::new(MockBackend::new());
    let tmp = tempfile::tempdir().unwrap();
    let pool = VmPoolManager::new_without_base_image(backend.clone(), tmp.path().to_path_buf(), Some(8));

    let vm_name = pool
        .get_or_boot("test-project", PathBuf::from("/tmp/workspace"), VmConfig::default())
        .await
        .unwrap();

    assert!(vm_name.contains("test-project"));
    assert_eq!(pool.running_count().await, 1);

    pool.stop("test-project").await.unwrap();
}

#[tokio::test]
async fn test_vm_idempotent_boot() {
    let backend = Arc::new(MockBackend::new());
    let tmp = tempfile::tempdir().unwrap();
    let pool = VmPoolManager::new_without_base_image(backend, tmp.path().to_path_buf(), Some(8));

    let name1 = pool
        .get_or_boot("proj1", PathBuf::from("/tmp/ws"), VmConfig::default())
        .await
        .unwrap();
    let name2 = pool
        .get_or_boot("proj1", PathBuf::from("/tmp/ws"), VmConfig::default())
        .await
        .unwrap();

    assert_eq!(name1, name2);
    assert_eq!(pool.running_count().await, 1);
}
