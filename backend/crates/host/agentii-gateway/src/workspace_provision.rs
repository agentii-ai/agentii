//! Workspace provisioning orchestrator for cloud VMs.
//!
//! Chains the full boot sequence after `VmPoolManager::get_or_boot()`:
//! 1. Initial sync (Supabase Storage → persistent volume)
//! 2. Context generation (agentii.md → CLAUDE.md, .goosehints, etc.)
//! 3. MCP provisioning (edgartools-mcp for each installed CLI)
//! 4. File watcher start (agentii.md live regeneration)
//! 5. Upload watcher start (debounced sync back to Supabase Storage)
//!
//! This module lives in the gateway crate because it depends on both
//! `agentii-vm` (sync, MCP provisioner) and `agentii-context-gen` (parser, generators).

use std::path::{Path, PathBuf};
use std::sync::Arc;

use agentii_financial_memory::{AgentiiMdParser, ContextFileGenerator, FinancialMemoryWatcher};
use agentii_vm::provisioner::McpProvisioner;
use agentii_vm::sync::{StorageBackend, SyncError, VolumeSync};
use tracing::{info, warn};

/// Result of a full workspace provisioning sequence.
#[derive(Debug)]
pub struct ProvisionResult {
    /// Number of files synced from remote storage.
    pub files_synced: usize,
    /// Whether context files (CLAUDE.md etc.) were generated.
    pub context_generated: bool,
    /// CLI names that had MCP configured.
    pub mcp_configured: Vec<String>,
}

/// Errors from workspace provisioning.
#[derive(Debug, thiserror::Error)]
pub enum ProvisionError {
    #[error("Sync error: {0}")]
    Sync(#[from] SyncError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("VM error: {0}")]
    Vm(String),
}

/// Run the full workspace provisioning sequence for a cloud VM.
///
/// Call this after `VmPoolManager::get_or_boot()` returns successfully.
/// The `volume_path` is the persistent volume mount point inside the VM
/// (e.g. `/workspace/`). Files are synced from Supabase Storage, then
/// context-gen and MCP provisioning run.
pub async fn provision_workspace(
    project_id: &str,
    volume_path: PathBuf,
    storage: Arc<dyn StorageBackend>,
    mcp_provisioner: Option<&McpProvisioner>,
    cli_registry: &[agentii_protocol::cli_registry::CliEntry],
) -> Result<ProvisionResult, ProvisionError> {
    info!(project = %project_id, volume = %volume_path.display(), "Starting workspace provisioning");

    // 1. Initial sync: Supabase Storage → persistent volume
    let sync = VolumeSync::new(project_id.to_string(), volume_path.clone(), storage);
    let sync_stats = sync.initial_download().await?;
    info!(
        project = %project_id,
        files = sync_stats.files_synced,
        bytes = sync_stats.bytes_transferred,
        "Initial sync complete"
    );

    // 2. Ensure workspace directories exist (spec 017: sessions/snapshots at workspace root)
    tokio::fs::create_dir_all(volume_path.join("sessions")).await?;
    tokio::fs::create_dir_all(volume_path.join("snapshots")).await?;
    tokio::fs::create_dir_all(volume_path.join(".agentii/skills")).await?;

    // 3. Context generation: agentii.md → CLAUDE.md, .goosehints, etc.
    let context_generated = generate_context(&volume_path, project_id);

    // 4. MCP provisioning: configure edgartools-mcp for installed CLIs
    let mcp_configured = if let Some(provisioner) = mcp_provisioner {
        match provisioner.provision_all(cli_registry).await {
            Ok(configured) => configured,
            Err(e) => {
                warn!(project = %project_id, error = %e, "MCP provisioning failed");
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    // 5. Start file watcher for live agentii.md → context-gen regeneration
    start_watcher_background(&volume_path);

    info!(
        project = %project_id,
        files_synced = sync_stats.files_synced,
        context_generated,
        mcp_configured = ?mcp_configured,
        "Workspace provisioning complete"
    );

    Ok(ProvisionResult {
        files_synced: sync_stats.files_synced,
        context_generated,
        mcp_configured,
    })
}

/// Parse agentii.md and generate all CLI context files (CLAUDE.md, .goosehints, etc.).
/// Uses agentii-financial-memory crate for parsing and generation.
fn generate_context(volume_path: &Path, project_id: &str) -> bool {
    let parsed = AgentiiMdParser::parse(volume_path);
    if parsed.level1_content.is_empty() {
        info!(project = %project_id, "agentii.md empty or missing — skipping context generation");
        return false;
    }
    ContextFileGenerator::regenerate_all(volume_path, &parsed);
    info!(
        project = %project_id,
        tickers = ?parsed.tickers,
        "Context files generated from agentii.md"
    );
    true
}

/// Start the agentii.md file watcher in a background thread.
/// Watches for changes to agentii.md and style.md, regenerates context files on change.
fn start_watcher_background(volume_path: &Path) {
    let path = volume_path.to_path_buf();
    std::thread::spawn(move || {
        match FinancialMemoryWatcher::start(path.clone()) {
            Ok(_watcher) => {
                info!(path = %path.display(), "Financial memory watcher started");
                // Keep the thread alive — watcher runs until dropped
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
            Err(e) => {
                warn!(path = %path.display(), error = %e, "Failed to start financial memory watcher");
            }
        }
    });
}
