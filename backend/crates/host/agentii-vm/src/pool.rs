use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{Mutex, RwLock};
use tracing::{info, warn};

use agentii_protocol::vm::{VmConfig, VmStatus};

use crate::backend::{VmBackendTrait, VmBootOptions, VmError, VmExecOptions, VmResult};
use crate::base_image::BaseImageManager;
use crate::instance::{DrainPhase, VmInstance};
use crate::observability::{LogLevel, VmEventLogger, VmEventType};

/// Disk usage report for all project VMs.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DiskUsageReport {
    /// Base image disk size in bytes.
    pub base_image_bytes: u64,
    /// Per-project disk deltas (actual bytes used beyond base).
    pub projects: Vec<ProjectDiskUsage>,
    /// Total actual disk usage across all VMs.
    pub total_bytes: u64,
}

/// Disk usage for a single project VM.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ProjectDiskUsage {
    pub project_id: String,
    pub vm_name: String,
    /// Actual disk bytes used (delta from base).
    pub actual_bytes: u64,
    /// Virtual disk size.
    pub virtual_bytes: u64,
}

/// Manages a pool of VMs, one per project. Enforces pool limits with LRU eviction.
pub struct VmPoolManager {
    /// Active VM instances keyed by project_id.
    instances: Arc<RwLock<HashMap<String, VmInstance>>>,
    /// VM backend engine.
    backend: Arc<dyn VmBackendTrait>,
    /// Maximum number of concurrent VMs.
    max_pool_size: usize,
    /// Grace period before stopping VM after last window closes.
    grace_period: Duration,
    /// Base path for persistent volumes.
    state_base_path: PathBuf,
    /// Base image manager for golden image lifecycle.
    base_image: BaseImageManager,
    /// Whether base image has been ensured this session.
    base_image_ready: AtomicBool,
    /// Structured event logger for observability.
    logger: VmEventLogger,
    /// Per-project boot locks to prevent concurrent `limactl create` for the same VM.
    /// Two WebSocket connections arriving simultaneously (e.g. React Strict Mode
    /// double-mount) would otherwise race on VM creation.
    boot_locks: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
}

impl VmPoolManager {
    /// Create a new pool manager.
    ///
    /// Pool limit: `max(2, floor(available_RAM_GB / 2))`
    pub fn new(
        backend: Arc<dyn VmBackendTrait>,
        state_base_path: PathBuf,
        available_ram_gb: Option<u64>,
    ) -> Self {
        let ram_gb = available_ram_gb.unwrap_or(8);
        let max_pool_size = std::cmp::max(2, (ram_gb / 2) as usize);

        info!(
            max_pool_size,
            backend = backend.name(),
            "VmPoolManager initialized"
        );

        Self {
            instances: Arc::new(RwLock::new(HashMap::new())),
            backend,
            max_pool_size,
            grace_period: Duration::from_secs(300),
            state_base_path,
            base_image: BaseImageManager::default_with_template(),
            base_image_ready: AtomicBool::new(false),
            logger: VmEventLogger::new(),
            boot_locks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a pool manager that skips base image provisioning.
    /// Used for testing with mock backends that don't need Lima.
    pub fn new_without_base_image(
        backend: Arc<dyn VmBackendTrait>,
        state_base_path: PathBuf,
        available_ram_gb: Option<u64>,
    ) -> Self {
        let pool = Self::new(backend, state_base_path, available_ram_gb);
        pool.base_image_ready.store(true, Ordering::Relaxed);
        pool
    }

    /// Get or boot a VM for the given project.
    pub async fn get_or_boot(
        &self,
        project_id: &str,
        workspace_path: PathBuf,
        config: VmConfig,
    ) -> VmResult<String> {
        // Acquire a per-project boot lock so two concurrent WebSocket connections
        // (e.g. React Strict Mode double-mount) don't race on `limactl create`.
        let project_lock = {
            let mut locks = self.boot_locks.lock().await;
            locks
                .entry(project_id.to_string())
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone()
        };
        let _boot_guard = project_lock.lock().await;

        // Fast path: if another connection already booted this VM while we waited
        // for the lock, just return the existing VM name.
        {
            let instances = self.instances.read().await;
            if let Some(instance) = instances.get(project_id) {
                if instance.status == VmStatus::Running {
                    return Ok(instance.vm_name.clone());
                }
            }
        }

        let boot_start = std::time::Instant::now();

        // Ensure base image exists on first call
        if !self.base_image_ready.load(Ordering::Relaxed) {
            self.base_image
                .ensure_base_image()
                .await
                .map_err(|e| {
                    let err_msg = format!("Base image setup failed: {e}");
                    // Fire-and-forget error log (logger is not async-compatible in map_err)
                    tracing::error!(project = %project_id, error = %err_msg, "VmBoot failed");
                    VmError::BootFailed(err_msg)
                })?;
            self.base_image_ready.store(true, Ordering::Relaxed);
        }

        // Check if VM already exists
        {
            let mut instances = self.instances.write().await;
            if let Some(instance) = instances.get_mut(project_id) {
                instance.touch();

                if instance.status == VmStatus::Running {
                    return Ok(instance.vm_name.clone());
                }

                // Stopped but NOT evicted → warm resume (backend.boot handles this)
                if instance.status == VmStatus::Stopped && !instance.evicted {
                    info!(project = %project_id, vm = %instance.vm_name, "Warm-resuming stopped VM");
                    let boot_options = VmBootOptions {
                        vm_name: instance.vm_name.clone(),
                        workspace_path: workspace_path.clone(),
                        permission_tier: config.permission_tier,
                        ram_mb: config.ram_mb,
                        cpus: config.cpus,
                        env: config.env.clone(),
                        persistent_volume_path: Some(instance.persistent_volume_path.clone()),
                        guest_workspace_path: "/workspace/".into(),
                        guest_pv_path: "/home/agentii.linux/".into(),
                        base_image_name: String::new(),
                    };
                    match self.backend.boot(&boot_options).await {
                        Ok(()) => {
                            instance.status = VmStatus::Running;
                            instance.add_window();
                            self.logger.log_event(
                                project_id,
                                VmEventType::VmBoot,
                                LogLevel::Info,
                                Some(boot_start.elapsed().as_millis() as u64),
                                serde_json::json!({"method": "warm_resume"}),
                            ).await;
                            return Ok(instance.vm_name.clone());
                        }
                        Err(e) => {
                            self.logger.log_event(
                                project_id,
                                VmEventType::VmError,
                                LogLevel::Error,
                                Some(boot_start.elapsed().as_millis() as u64),
                                serde_json::json!({"error": e.to_string(), "method": "warm_resume"}),
                            ).await;
                            return Err(e);
                        }
                    }
                }

                // Evicted → delete old VM and re-clone from base
                if instance.status == VmStatus::Stopped && instance.evicted {
                    info!(project = %project_id, vm = %instance.vm_name, "Re-cloning evicted VM from base image");
                    let _ = self.backend.delete(&instance.vm_name).await;
                    // Fall through to create a fresh clone below
                }
            }
        }

        // Evict if at capacity
        self.evict_if_needed().await?;

        // Create persistent volume directory
        let pv_path = self.state_base_path.join(project_id);
        tokio::fs::create_dir_all(&pv_path)
            .await
            .map_err(VmError::Io)?;

        let instance = VmInstance::new(
            project_id.to_string(),
            workspace_path.clone(),
            pv_path.clone(),
            config.clone(),
        );

        let boot_options = VmBootOptions {
            vm_name: instance.vm_name.clone(),
            workspace_path,
            permission_tier: config.permission_tier,
            ram_mb: config.ram_mb,
            cpus: config.cpus,
            env: config.env.clone(),
            persistent_volume_path: Some(pv_path),
            guest_workspace_path: "/workspace/".into(),
            guest_pv_path: "/home/agentii.linux/".into(),
            base_image_name: String::new(),
        };

        match self.backend.boot(&boot_options).await {
            Ok(()) => {
                let vm_name = instance.vm_name.clone();
                let mut instances = self.instances.write().await;
                let mut instance = instance;
                instance.status = VmStatus::Running;
                instance.add_window();
                instances.insert(project_id.to_string(), instance);

                self.logger.log_event(
                    project_id,
                    VmEventType::VmBoot,
                    LogLevel::Info,
                    Some(boot_start.elapsed().as_millis() as u64),
                    serde_json::json!({"method": "clone"}),
                ).await;

                Ok(vm_name)
            }
            Err(e) => {
                self.logger.log_event(
                    project_id,
                    VmEventType::VmError,
                    LogLevel::Error,
                    Some(boot_start.elapsed().as_millis() as u64),
                    serde_json::json!({"error": e.to_string(), "method": "clone"}),
                ).await;
                Err(e)
            }
        }
    }

    /// Stop a VM for the given project using the three-phase drain sequence.
    pub async fn stop(&self, project_id: &str) -> VmResult<()> {
        self.drain_and_stop(project_id).await
    }

    /// Three-phase drain sequence (from MicroSandbox pattern).
    /// Phase 1 (5s): SIGTERM all user processes
    /// Phase 2 (3s): SIGKILL remaining
    /// Phase 3: limactl stop (or --force)
    pub async fn drain_and_stop(&self, project_id: &str) -> VmResult<()> {
        let drain_start = std::time::Instant::now();

        let vm_name = {
            let instances = self.instances.read().await;
            match instances.get(project_id) {
                Some(inst) => inst.vm_name.clone(),
                None => return Err(VmError::NotFound(project_id.to_string())),
            }
        };

        // Update status to Stopping, Phase 1
        {
            let mut instances = self.instances.write().await;
            if let Some(inst) = instances.get_mut(project_id) {
                inst.status = VmStatus::Stopping;
                inst.drain_phase = Some(DrainPhase::Graceful);
            }
        }

        // Phase 1: Graceful (SIGTERM, 5s timeout)
        info!(vm = %vm_name, phase = 1, "Drain: sending SIGTERM to user processes");
        let term_result = self
            .backend
            .exec(&VmExecOptions {
                vm_name: vm_name.clone(),
                command: "bash".into(),
                args: vec![
                    "-c".into(),
                    "kill -TERM $(pgrep -u agentii) 2>/dev/null || true".into(),
                ],
                env: Default::default(),
                cwd: None,
            })
            .await;

        if term_result.is_ok() {
            tokio::time::sleep(Duration::from_secs(5)).await;
        }

        // Phase 2: Terminate (SIGKILL, 3s timeout)
        {
            let mut instances = self.instances.write().await;
            if let Some(inst) = instances.get_mut(project_id) {
                inst.drain_phase = Some(DrainPhase::Terminate);
            }
        }
        info!(vm = %vm_name, phase = 2, "Drain: sending SIGKILL to remaining processes");
        let _ = self
            .backend
            .exec(&VmExecOptions {
                vm_name: vm_name.clone(),
                command: "bash".into(),
                args: vec![
                    "-c".into(),
                    "kill -KILL $(pgrep -u agentii) 2>/dev/null || true".into(),
                ],
                env: Default::default(),
                cwd: None,
            })
            .await;

        tokio::time::sleep(Duration::from_secs(3)).await;

        // Phase 3: Stop VM
        {
            let mut instances = self.instances.write().await;
            if let Some(inst) = instances.get_mut(project_id) {
                inst.drain_phase = Some(DrainPhase::Force);
            }
        }
        info!(vm = %vm_name, phase = 3, "Drain: stopping VM");
        self.backend.stop(&vm_name).await?;

        // Update status to Stopped, clear drain phase
        {
            let mut instances = self.instances.write().await;
            if let Some(inst) = instances.get_mut(project_id) {
                inst.status = VmStatus::Stopped;
                inst.drain_phase = None;
            }
        }

        info!(vm = %vm_name, "Drain complete");

        self.logger.log_event(
            project_id,
            VmEventType::VmStop,
            LogLevel::Info,
            Some(drain_start.elapsed().as_millis() as u64),
            serde_json::json!({"vm": vm_name}),
        ).await;

        Ok(())
    }

    /// Notify that a window was closed for a project.
    /// If no windows remain, schedule drain-and-stop after grace period.
    pub async fn window_closed(&self, project_id: &str) {
        let should_schedule_stop = {
            let mut instances = self.instances.write().await;
            if let Some(instance) = instances.get_mut(project_id) {
                instance.remove_window()
            } else {
                false
            }
        };

        if should_schedule_stop {
            let project_id = project_id.to_string();
            let grace = self.grace_period;
            let backend = self.backend.clone();
            let instances = self.instances.clone();

            tokio::spawn(async move {
                tokio::time::sleep(grace).await;

                // Check if still zero windows before draining
                let should_drain = {
                    let map = instances.read().await;
                    map.get(&project_id)
                        .map(|i| i.window_count == 0 && i.status == VmStatus::Running)
                        .unwrap_or(false)
                };

                if should_drain {
                    info!(project = %project_id, "Grace period expired, draining VM");

                    // Phase 1: Graceful (SIGTERM)
                    {
                        let mut map = instances.write().await;
                        if let Some(inst) = map.get_mut(&project_id) {
                            inst.status = VmStatus::Stopping;
                            inst.drain_phase = Some(DrainPhase::Graceful);
                        }
                    }
                    let vm_name = {
                        let map = instances.read().await;
                        map.get(&project_id).map(|i| i.vm_name.clone())
                    };
                    if let Some(ref vm) = vm_name {
                        let _ = backend
                            .exec(&VmExecOptions {
                                vm_name: vm.clone(),
                                command: "bash".into(),
                                args: vec![
                                    "-c".into(),
                                    "kill -TERM $(pgrep -u agentii) 2>/dev/null || true".into(),
                                ],
                                env: Default::default(),
                                cwd: None,
                            })
                            .await;
                        tokio::time::sleep(Duration::from_secs(5)).await;

                        // Phase 2: Terminate (SIGKILL)
                        {
                            let mut map = instances.write().await;
                            if let Some(inst) = map.get_mut(&project_id) {
                                inst.drain_phase = Some(DrainPhase::Terminate);
                            }
                        }
                        let _ = backend
                            .exec(&VmExecOptions {
                                vm_name: vm.clone(),
                                command: "bash".into(),
                                args: vec![
                                    "-c".into(),
                                    "kill -KILL $(pgrep -u agentii) 2>/dev/null || true".into(),
                                ],
                                env: Default::default(),
                                cwd: None,
                            })
                            .await;
                        tokio::time::sleep(Duration::from_secs(3)).await;

                        // Phase 3: Stop VM
                        {
                            let mut map = instances.write().await;
                            if let Some(inst) = map.get_mut(&project_id) {
                                inst.drain_phase = Some(DrainPhase::Force);
                            }
                        }
                        let _ = backend.stop(vm).await;
                        {
                            let mut map = instances.write().await;
                            if let Some(inst) = map.get_mut(&project_id) {
                                inst.status = VmStatus::Stopped;
                                inst.drain_phase = None;
                            }
                        }
                    }
                }
            });
        }
    }

    /// Evict the least-recently-used VM if pool is at capacity.
    async fn evict_if_needed(&self) -> VmResult<()> {
        let mut instances = self.instances.write().await;

        let running_count = instances
            .values()
            .filter(|i| i.status == VmStatus::Running)
            .count();

        if running_count < self.max_pool_size {
            return Ok(());
        }

        // Find LRU candidate (oldest last_active, no windows)
        let lru_project = instances
            .iter()
            .filter(|(_, i)| i.status == VmStatus::Running && i.window_count == 0)
            .min_by_key(|(_, i)| i.last_active)
            .map(|(k, _)| k.clone());

        if let Some(project_id) = lru_project {
            warn!(project = %project_id, "Evicting LRU VM to make room");
            if let Some(instance) = instances.get(&project_id) {
                self.backend.stop(&instance.vm_name).await?;
            }
            if let Some(instance) = instances.get_mut(&project_id) {
                instance.status = VmStatus::Stopped;
                instance.evicted = true;
            }

            self.logger.log_event(
                &project_id,
                VmEventType::VmEvict,
                LogLevel::Warn,
                None,
                serde_json::json!({"reason": "pool_capacity"}),
            ).await;
        }

        Ok(())
    }

    /// List all VM instances.
    pub async fn list(&self) -> Vec<(String, VmStatus)> {
        let instances = self.instances.read().await;
        instances
            .iter()
            .map(|(k, v)| (k.clone(), v.status))
            .collect()
    }

    /// Get the VM name for a project.
    pub async fn vm_name(&self, project_id: &str) -> Option<String> {
        let instances = self.instances.read().await;
        instances.get(project_id).map(|i| i.vm_name.clone())
    }

    /// Check if a VM is already running for this project. Returns the VM name
    /// instantly without blocking on boot. Used by the terminal WS handler to
    /// avoid blocking the WebSocket for 30+ seconds during VM creation.
    pub async fn try_get_running(&self, project_id: &str) -> Option<String> {
        let instances = self.instances.read().await;
        instances.get(project_id).and_then(|i| {
            if i.status == VmStatus::Running {
                Some(i.vm_name.clone())
            } else {
                None
            }
        })
    }

    /// Get a reference to the VM backend.
    pub fn backend(&self) -> Arc<dyn VmBackendTrait> {
        self.backend.clone()
    }

    /// Current pool size (running VMs).
    pub async fn running_count(&self) -> usize {
        let instances = self.instances.read().await;
        instances
            .values()
            .filter(|i| i.status == VmStatus::Running)
            .count()
    }

    /// Pre-warm a VM for a project (start boot in background).
    /// Called by gateway when user navigates to project IDE page.
    ///
    /// Spawns a background task that ensures the base image is ready and then
    /// boots the VM via the backend. If the VM is already running, this is a no-op.
    pub fn pre_warm<F>(&self, project_id: String, workspace_path: PathBuf, config: VmConfig, on_boot: Option<F>)
    where
        F: FnOnce() + Send + 'static,
    {
        let pool = self.instances.clone();
        let base_image_ready = self.base_image_ready.load(Ordering::Relaxed);
        let backend = self.backend.clone();
        let state_base = self.state_base_path.clone();

        // Check if already running
        if let Ok(instances) = pool.try_read() {
            if let Some(instance) = instances.get(&project_id) {
                if instance.status == VmStatus::Running {
                    // Still call on_boot if provided (VM already running)
                    if let Some(cb) = on_boot {
                        cb();
                    }
                    return; // Already running, no-op
                }
            }
        }

        // Spawn background task to ensure base image + boot VM
        tokio::spawn(async move {
            info!(project = %project_id, "Pre-warming VM");

            // Ensure base image is ready
            if !base_image_ready {
                let mgr = BaseImageManager::default_with_template();
                if let Err(e) = mgr.ensure_base_image().await {
                    warn!(project = %project_id, error = %e, "Pre-warm: base image setup failed");
                    return;
                }
            }

            // Boot the VM in the background
            let vm_name = format!("agentii-{}", project_id.replace('/', "-"));
            let pv_path = state_base.join(&project_id);
            let _ = std::fs::create_dir_all(&pv_path);

            let boot_opts = VmBootOptions {
                vm_name: vm_name.clone(),
                workspace_path: workspace_path.clone(),
                ..VmBootOptions::default()
            };
            match backend.boot(&boot_opts).await {
                Ok(()) => {
                    info!(project = %project_id, vm = %vm_name, "Pre-warm: VM booted successfully");
                    let mut instances = pool.write().await;
                    if !instances.contains_key(&project_id) {
                        let mut instance = VmInstance::new(
                            project_id.clone(),
                            workspace_path,
                            pv_path,
                            config,
                        );
                        instance.status = VmStatus::Running;
                        instances.insert(project_id.clone(), instance);
                    }
                    // Call callback after VM is marked as running
                    if let Some(cb) = on_boot {
                        cb();
                    }
                }
                Err(e) => {
                    warn!(project = %project_id, error = %e, "Pre-warm: VM boot failed");
                }
            }
        });
    }

    /// Calculate disk usage across all project VMs.
    pub async fn disk_usage(&self) -> VmResult<DiskUsageReport> {
        let instances = self.instances.read().await;
        let mut projects = Vec::new();
        let mut total: u64 = 0;

        for (project_id, instance) in instances.iter() {
            let output = tokio::process::Command::new("qemu-img")
                .args(["info", "--output=json"])
                .arg(Self::qcow2_path(&instance.vm_name))
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .output()
                .await;

            let (actual, virtual_size) = match output {
                Ok(out) if out.status.success() => {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    if let Ok(info) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        let a = info
                            .get("actual-size")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let vs = info
                            .get("virtual-size")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        (a, vs)
                    } else {
                        (0, 0)
                    }
                }
                _ => (0, 0),
            };

            total += actual;
            projects.push(ProjectDiskUsage {
                project_id: project_id.clone(),
                vm_name: instance.vm_name.clone(),
                actual_bytes: actual,
                virtual_bytes: virtual_size,
            });
        }

        Ok(DiskUsageReport {
            base_image_bytes: self.base_image.project_disk_delta("_base").await,
            projects,
            total_bytes: total,
        })
    }

    /// Get the QCOW2 disk path for a Lima VM.
    fn qcow2_path(vm_name: &str) -> String {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        format!("{home}/.lima/{vm_name}/diffdisk")
    }
}
