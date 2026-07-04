use std::path::PathBuf;

use async_trait::async_trait;
use tracing::warn;

use agentii_protocol::vm::VmStatus;

use crate::backend::{BackendCapabilities, VmBackendTrait, VmBootOptions, VmError, VmExecOptions, VmExecOutput, VmResult};

/// OrbStack backend stub — faster boot (~1s) but commercial license.
/// Full implementation deferred; interface matches LimaBackend.
pub struct OrbStackBackend;

impl OrbStackBackend {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl VmBackendTrait for OrbStackBackend {
    async fn boot(&self, options: &VmBootOptions) -> VmResult<()> {
        warn!(vm = %options.vm_name, "OrbStack backend not yet implemented");
        Err(VmError::Unavailable("OrbStack backend not yet implemented".into()))
    }

    async fn stop(&self, _vm_name: &str) -> VmResult<()> {
        Err(VmError::Unavailable("OrbStack backend not yet implemented".into()))
    }

    async fn status(&self, _vm_name: &str) -> VmResult<VmStatus> {
        Err(VmError::Unavailable("OrbStack backend not yet implemented".into()))
    }

    async fn exec(&self, _options: &VmExecOptions) -> VmResult<VmExecOutput> {
        Err(VmError::Unavailable("OrbStack backend not yet implemented".into()))
    }

    async fn mount_workspace(
        &self,
        _vm_name: &str,
        _host_path: &PathBuf,
        _vm_path: &str,
    ) -> VmResult<()> {
        Err(VmError::Unavailable("OrbStack backend not yet implemented".into()))
    }

    async fn delete(&self, _vm_name: &str) -> VmResult<()> {
        Err(VmError::Unavailable("OrbStack backend not yet implemented".into()))
    }

    async fn is_available(&self) -> bool {
        false
    }

    fn name(&self) -> &str {
        "orbstack"
    }

    fn capabilities(&self) -> BackendCapabilities {
        BackendCapabilities {
            supports_clone: false,
            supports_virtiofs: true,
            supports_snapshot: false,
            supports_resize: true,
        }
    }
}
