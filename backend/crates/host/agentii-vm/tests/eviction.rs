use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use agentii_protocol::vm::{VmConfig, VmStatus};
use agentii_vm::backend::{VmBackendTrait, VmBootOptions, VmError, VmExecOptions, VmExecOutput, VmResult};
use agentii_vm::pool::VmPoolManager;
use async_trait::async_trait;
use tokio::sync::Mutex;

struct MockBackend {
    vms: Mutex<HashMap<String, VmStatus>>,
}

impl MockBackend {
    fn new() -> Self {
        Self { vms: Mutex::new(HashMap::new()) }
    }
}

#[async_trait]
impl VmBackendTrait for MockBackend {
    async fn boot(&self, options: &VmBootOptions) -> VmResult<()> {
        self.vms.lock().await.insert(options.vm_name.clone(), VmStatus::Running);
        Ok(())
    }
    async fn stop(&self, vm_name: &str) -> VmResult<()> {
        if let Some(s) = self.vms.lock().await.get_mut(vm_name) { *s = VmStatus::Stopped; }
        Ok(())
    }
    async fn status(&self, vm_name: &str) -> VmResult<VmStatus> {
        self.vms.lock().await.get(vm_name).copied().ok_or(VmError::NotFound(vm_name.into()))
    }
    async fn exec(&self, _: &VmExecOptions) -> VmResult<VmExecOutput> {
        Ok(VmExecOutput { stdout: String::new(), stderr: String::new(), exit_code: 0 })
    }
    async fn mount_workspace(&self, _: &str, _: &PathBuf, _: &str) -> VmResult<()> { Ok(()) }
    async fn delete(&self, vm_name: &str) -> VmResult<()> {
        self.vms.lock().await.remove(vm_name); Ok(())
    }
    async fn is_available(&self) -> bool { true }
    fn name(&self) -> &str { "mock" }
}

#[tokio::test]
async fn test_lru_eviction() {
    let backend = Arc::new(MockBackend::new());
    let tmp = tempfile::tempdir().unwrap();
    // Pool limit = max(2, 4/2) = 2
    let pool = VmPoolManager::new_without_base_image(backend.clone(), tmp.path().to_path_buf(), Some(4));

    // Boot first VM
    pool.get_or_boot("proj-a", PathBuf::from("/tmp/a"), VmConfig::default()).await.unwrap();
    // Close all windows so it's evictable
    pool.window_closed("proj-a").await;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    // Boot second VM
    pool.get_or_boot("proj-b", PathBuf::from("/tmp/b"), VmConfig::default()).await.unwrap();

    assert_eq!(pool.running_count().await, 2);

    // Boot third VM — should evict proj-a (LRU, no windows)
    pool.get_or_boot("proj-c", PathBuf::from("/tmp/c"), VmConfig::default()).await.unwrap();

    // proj-a should be stopped (evicted)
    let all = pool.list().await;
    let proj_a = all.iter().find(|(k, _)| k == "proj-a");
    if let Some((_, status)) = proj_a {
        assert_eq!(*status, VmStatus::Stopped);
    }
}
