//! Workspace initialization orchestrator.
//!
//! Handles the full boot sequence for a project workspace:
//! 1. Create workspace directory: `~/.agentii/workspaces/{user_id}/{project_id}/`
//! 2. Write `agentii.md` from provided content (rendered from agentii-template.md by frontend)
//! 3. Create `sessions/`, `snapshots/`, and `.agentii/skills/` directories
//!
//! Memory files (sessions/, snapshots/, agentii.md, style.md) live at the workspace
//! root for maximum visibility — NOT under `.agentii/memory/` (spec 017 supersedes
//! the old spec 015 paths).
//!
//! Design: Only `agentii.md` lives in the workspace root. CLI-specific context
//! files (CLAUDE.md, .goosehints, codex.md) are NOT generated — they add clutter
//! and confuse users. When the VM layer is wired in, context-gen runs inside the
//! VM only if the user explicitly installs a CLI that needs it.

use std::path::{Path, PathBuf};

use tracing::{info, warn};

/// Input for initializing a workspace via the HTTP endpoint.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct WorkspaceInitRequest {
    pub project_id: String,
    pub user_id: String,
    /// Full rendered agentii.md content (from agentii-template.md with substitutions).
    /// Required for first init. Ignored if agentii.md already exists.
    pub agentii_md: Option<String>,
}

/// Response from workspace initialization.
#[derive(Debug, Clone, serde::Serialize)]
pub struct WorkspaceInitResponse {
    pub workspace_path: String,
    pub agentii_md_exists: bool,
    /// Whether the workspace was freshly created (true) or already existed (false).
    pub created: bool,
}

/// Resolve the workspace directory for a project, scoped by user.
///
/// Convention: `~/.agentii/workspaces/{user_id}/{project_id}/`
pub fn resolve_workspace(user_id: &str, project_id: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(format!(
        "{home}/.agentii/workspaces/{user_id}/{project_id}"
    ))
}

/// Resolve workspace with only project_id (fallback for anonymous / dev mode).
///
/// Convention: `~/.agentii/workspaces/local/{project_id}/`
pub fn resolve_workspace_anonymous(project_id: &str) -> PathBuf {
    resolve_workspace("local", project_id)
}

/// Find the workspace directory for a project, searching across all user directories.
///
/// The scaffold creates workspaces at `~/.agentii/workspaces/{user_id}/{project_id}/`.
/// The terminal handler doesn't know the user_id, so we search all subdirectories
/// under `~/.agentii/workspaces/` for a matching project_id.
///
/// Falls back to `~/.agentii/workspaces/local/{project_id}/` if not found.
pub fn find_workspace(project_id: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let workspaces_root = PathBuf::from(format!("{home}/.agentii/workspaces"));

    if let Ok(entries) = std::fs::read_dir(&workspaces_root) {
        for entry in entries.flatten() {
            if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            let candidate = entry.path().join(project_id);
            if candidate.join("agentii.md").exists() {
                return candidate;
            }
            // Also match if the directory exists (even without agentii.md yet)
            if candidate.exists() {
                return candidate;
            }
        }
    }

    // Fallback: use the anonymous "local" path
    resolve_workspace("local", project_id)
}

/// Initialize a workspace directory with only `agentii.md`.
///
/// This is idempotent — safe to call on an already-initialized workspace.
/// Does NOT generate CLI-specific context files (CLAUDE.md, codex.md, etc.).
pub fn init_workspace(
    workspace: &Path,
    agentii_md_content: Option<&str>,
) -> Result<WorkspaceInitResponse, WorkspaceInitError> {
    let already_existed = workspace.join("agentii.md").exists();

    // 1. Create workspace directory tree
    std::fs::create_dir_all(workspace)?;
    std::fs::create_dir_all(workspace.join("sessions"))?;
    std::fs::create_dir_all(workspace.join("snapshots"))?;
    std::fs::create_dir_all(workspace.join(".agentii/skills"))?;

    info!(workspace = %workspace.display(), "Workspace directories ready");

    // 2. Write agentii.md from template content (only on first init)
    let agentii_md_path = workspace.join("agentii.md");

    if let Some(content) = agentii_md_content {
        if !agentii_md_path.exists() {
            std::fs::write(&agentii_md_path, content)?;
            info!(workspace = %workspace.display(), "agentii.md created from template");
        }
    }

    let agentii_md_exists = agentii_md_path.exists();

    Ok(WorkspaceInitResponse {
        workspace_path: workspace.to_string_lossy().to_string(),
        agentii_md_exists,
        created: !already_existed,
    })
}

// ---------------------------------------------------------------------------
// T022: bootstrap_memory — create memory directory structure
// ---------------------------------------------------------------------------

/// Bootstrap the workspace memory hierarchy (spec 017).
///
/// Creates:
/// - `/workspace/snapshots/` for daily trading journal snapshots
/// - `/workspace/sessions/` for per-session logs
/// - Skeleton `agentii.md` at workspace root if not present
/// - Skeleton `style.md` at workspace root if not present
///
/// Memory files live at workspace root for maximum visibility — NOT under
/// `.agentii/memory/` (spec 017 supersedes spec 015 FR-024).
///
/// Idempotent — safe to call on an already-bootstrapped workspace.
pub fn bootstrap_memory(
    workspace: &Path,
    project_name: &str,
) -> Result<(), WorkspaceInitError> {
    // Migrate old .agentii/memory/ paths to workspace root (spec 017 supersedes spec 015)
    migrate_old_memory_paths(workspace);

    // Create memory directories at workspace root
    std::fs::create_dir_all(workspace.join("snapshots"))?;
    std::fs::create_dir_all(workspace.join("sessions"))?;

    // Create skeleton agentii.md if it doesn't exist
    let agentii_md = workspace.join("agentii.md");
    if !agentii_md.exists() {
        let skeleton = format!(
            "# {project_name}\n\n\
             ## Company Identity\n\n\
             <!-- Fill in: Legal Name, Former Names, Sector, Market Cap -->\n\n\
             ## Ticker Symbols\n\n\
             - Primary: [TICKER]\n\n\
             ## Investment Thesis\n\n\
             <!-- Document your core thesis here -->\n\n\
             ## Key Catalysts\n\n\
             <!-- Track upcoming catalysts with dates -->\n\n\
             ## Key Metrics\n\n\
             <!-- Define the metrics you track -->\n\n\
             ## Risk Factors\n\n\
             <!-- Document key risks -->\n\n\
             ## Agent Instructions\n\n\
             <!-- Custom instructions for all CLI agents -->\n"
        );
        std::fs::write(&agentii_md, skeleton)?;
        info!(workspace = %workspace.display(), "Created skeleton agentii.md");
    }

    // Create skeleton style.md if it doesn't exist
    let style_md = workspace.join("style.md");
    if !style_md.exists() {
        let skeleton = "# Investment & Analysis Style\n\n\
             ## Investment Philosophy\n\n\
             ## Trading Execution\n\n\
             ## Analysis Preferences\n\n\
             ## Output Formatting\n\n\
             ## Risk Framework\n";
        std::fs::write(&style_md, skeleton)?;
        info!(workspace = %workspace.display(), "Created skeleton style.md");
    }

    info!(workspace = %workspace.display(), "Memory hierarchy bootstrapped");
    Ok(())
}

/// Start the agentii.md file watcher for live context regeneration.
///
/// Returns `true` if the watcher was started successfully.
pub fn start_watcher(_workspace: &Path) -> bool {
    // Context-gen file watcher disabled — no CLI-specific files to regenerate.
    // Will be re-enabled when VM layer is wired in and CLIs are installed.
    false
}

/// Migrate files from old `.agentii/memory/sessions/` and `.agentii/memory/snapshots/`
/// to the new workspace-root `sessions/` and `snapshots/` directories.
///
/// Moves each file individually (copy + delete) to preserve content.
/// Idempotent — skips if old directories don't exist.
/// Removes old `.agentii/memory/` tree after successful migration.
fn migrate_old_memory_paths(workspace: &Path) {
    let old_sessions = workspace.join(".agentii/memory/sessions");
    let old_snapshots = workspace.join(".agentii/memory/snapshots");
    let old_memory_root = workspace.join(".agentii/memory");

    let mut migrated = 0;

    // Migrate old sessions
    if old_sessions.is_dir() {
        let new_sessions = workspace.join("sessions");
        let _ = std::fs::create_dir_all(&new_sessions);
        if let Ok(entries) = std::fs::read_dir(&old_sessions) {
            for entry in entries.flatten() {
                let filename = entry.file_name();
                let dest = new_sessions.join(&filename);
                if !dest.exists() {
                    if let Ok(content) = std::fs::read(entry.path()) {
                        if std::fs::write(&dest, &content).is_ok() {
                            let _ = std::fs::remove_file(entry.path());
                            migrated += 1;
                        }
                    }
                }
            }
        }
    }

    // Migrate old snapshots
    if old_snapshots.is_dir() {
        let new_snapshots = workspace.join("snapshots");
        let _ = std::fs::create_dir_all(&new_snapshots);
        if let Ok(entries) = std::fs::read_dir(&old_snapshots) {
            for entry in entries.flatten() {
                let filename = entry.file_name();
                let dest = new_snapshots.join(&filename);
                if !dest.exists() {
                    if let Ok(content) = std::fs::read(entry.path()) {
                        if std::fs::write(&dest, &content).is_ok() {
                            let _ = std::fs::remove_file(entry.path());
                            migrated += 1;
                        }
                    }
                }
            }
        }
    }

    // Clean up old .agentii/memory/ tree if empty
    if old_memory_root.is_dir() {
        let _ = std::fs::remove_dir_all(&old_memory_root);
    }

    // Also migrate from .agentii/sessions/ (even older pattern from init_workspace)
    let old_agentii_sessions = workspace.join(".agentii/sessions");
    if old_agentii_sessions.is_dir() {
        let new_sessions = workspace.join("sessions");
        let _ = std::fs::create_dir_all(&new_sessions);
        if let Ok(entries) = std::fs::read_dir(&old_agentii_sessions) {
            for entry in entries.flatten() {
                let filename = entry.file_name();
                // Skip .gitkeep
                if filename.to_string_lossy() == ".gitkeep" {
                    continue;
                }
                let dest = new_sessions.join(&filename);
                if !dest.exists() {
                    if let Ok(content) = std::fs::read(entry.path()) {
                        if std::fs::write(&dest, &content).is_ok() {
                            let _ = std::fs::remove_file(entry.path());
                            migrated += 1;
                        }
                    }
                }
            }
        }
        // Remove old dir if empty
        let _ = std::fs::remove_dir(&old_agentii_sessions);
    }

    if migrated > 0 {
        info!(
            workspace = %workspace.display(),
            files = migrated,
            "Migrated memory files from old .agentii/ paths to workspace root"
        );
    }
}

/// Handle the POST /api/workspace/init HTTP endpoint.
///
/// Accepts JSON body with project_id, user_id, and optional agentii_md content.
/// Returns JSON with workspace_path and status.
pub async fn handle_workspace_init(body: &[u8]) -> (u16, Vec<u8>) {
    let req: WorkspaceInitRequest = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Invalid request body: {e}") });
            return (400, serde_json::to_vec(&err).unwrap());
        }
    };

    let workspace = resolve_workspace(&req.user_id, &req.project_id);

    match init_workspace(&workspace, req.agentii_md.as_deref()) {
        Ok(resp) => {
            // T025: Extended boot provisioning steps 4-9 from cli-provisioning.md
            let project_name = &req.project_id;

            // Step 4: Bootstrap memory hierarchy
            if let Err(e) = bootstrap_memory(&workspace, project_name) {
                warn!(error = %e, "bootstrap_memory failed (non-fatal)");
            }

            // Step 5: Inject system prompt for all CLI agents
            // Always use virtual /workspace/ path so CLI agents never see the real host path
            // Always regenerate — the prompt content may have changed (e.g., spec 017 path migration)
            let prompt = agentii_vm::system_prompt::generate_system_prompt(
                project_name, "/workspace/",
            );
            let prompt_path = workspace.join(".agentii/system_prompt.md");
            {
                if let Err(e) = std::fs::write(&prompt_path, &prompt) {
                    warn!(error = %e, "Failed to write system_prompt.md (non-fatal)");
                } else {
                    // Copy to CLI-specific project instructions files
                    // Always overwrite — ensures old paths are replaced
                    let cli_targets = [
                        ".goosehints",
                        "CLAUDE.md",
                        ".opencode/instructions.md",
                        "codex.md",
                    ];
                    for target in &cli_targets {
                        let target_path = workspace.join(target);
                        if let Some(parent) = target_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        let _ = std::fs::write(&target_path, &prompt);
                    }
                    info!(workspace = %workspace.display(), "System prompt injected for all CLIs");
                }
            }

            (200, serde_json::to_vec(&resp).unwrap())
        }
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Workspace init failed: {e}") });
            (500, serde_json::to_vec(&err).unwrap())
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceInitError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// ---------------------------------------------------------------------------
// Workspace file API — lets the frontend file tree read the local filesystem
// ---------------------------------------------------------------------------

/// Validate a relative path against the 6-gate path validator from agentii-vm.
/// Returns the resolved absolute path on success, or an HTTP error tuple on failure.
fn validate_workspace_path(workspace: &Path, rel_path: &str) -> Result<PathBuf, (u16, Vec<u8>)> {
    let rel = rel_path.trim_start_matches('/');
    match agentii_vm::security::path_validator::validate_path_host(rel, workspace) {
        Ok(validated) => Ok(validated),
        Err(e) => {
            warn!(path = %rel_path, error = %e, "Path validation rejected");
            let err = serde_json::json!({ "error": format!("Path rejected: {e}") });
            Err((400, serde_json::to_vec(&err).unwrap()))
        }
    }
}

/// POST /api/workspace/files — list files in a project workspace directory.
///
/// Body: `{"project_id": "...", "path": "/"}` (path is relative to workspace root)
/// Returns: `[{"name": "agentii.md", "path": "/agentii.md", "is_directory": false, "size": 1234}]`
pub async fn handle_workspace_files(body: &[u8]) -> (u16, Vec<u8>) {
    #[derive(serde::Deserialize)]
    struct Req {
        project_id: String,
        #[serde(default = "default_root")]
        path: String,
    }
    fn default_root() -> String {
        "/".into()
    }

    let req: Req = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Invalid request: {e}") });
            return (400, serde_json::to_vec(&err).unwrap());
        }
    };

    let workspace = find_workspace(&req.project_id);
    let target = if req.path == "/" || req.path.is_empty() {
        workspace.clone()
    } else {
        match validate_workspace_path(&workspace, &req.path) {
            Ok(p) => p,
            Err(resp) => return resp,
        }
    };

    if !target.exists() {
        let err = serde_json::json!({ "error": "Directory not found" });
        return (404, serde_json::to_vec(&err).unwrap());
    }

    match list_directory(&target, &workspace) {
        Ok(entries) => (200, serde_json::to_vec(&entries).unwrap()),
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Failed to list: {e}") });
            (500, serde_json::to_vec(&err).unwrap())
        }
    }
}

fn list_directory(
    dir: &Path,
    workspace_root: &Path,
) -> Result<Vec<serde_json::Value>, std::io::Error> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden files/dirs (dotfiles)
        if name.starts_with('.') {
            continue;
        }
        // Skip symlinks whose targets escape the workspace boundary
        let ft = entry.file_type()?;
        if ft.is_symlink() {
            match std::fs::canonicalize(entry.path()) {
                Ok(real) if real.starts_with(workspace_root) => {} // safe
                Ok(real) => {
                    warn!(
                        link = %entry.path().display(),
                        target = %real.display(),
                        "Skipping symlink escaping workspace"
                    );
                    continue;
                }
                Err(_) => continue, // dangling symlink
            }
        }
        let metadata = entry.metadata()?;
        let rel_path = entry
            .path()
            .strip_prefix(workspace_root)
            .unwrap_or(entry.path().as_path())
            .to_string_lossy()
            .to_string();
        entries.push(serde_json::json!({
            "name": name,
            "path": format!("/{rel_path}"),
            "is_directory": metadata.is_dir(),
            "size": metadata.len(),
        }));
    }
    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        let a_dir = a["is_directory"].as_bool().unwrap_or(false);
        let b_dir = b["is_directory"].as_bool().unwrap_or(false);
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => {
                let a_name = a["name"].as_str().unwrap_or("");
                let b_name = b["name"].as_str().unwrap_or("");
                a_name.to_lowercase().cmp(&b_name.to_lowercase())
            }
        }
    });
    Ok(entries)
}

/// POST /api/workspace/read — read a file from the project workspace.
///
/// Body: `{"project_id": "...", "path": "/agentii.md"}`
/// Returns: `{"content": "# Project...", "size": 1234}`
pub async fn handle_workspace_read(body: &[u8]) -> (u16, Vec<u8>) {
    #[derive(serde::Deserialize)]
    struct Req {
        project_id: String,
        path: String,
    }

    let req: Req = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Invalid request: {e}") });
            return (400, serde_json::to_vec(&err).unwrap());
        }
    };

    let workspace = find_workspace(&req.project_id);
    let file_path = match validate_workspace_path(&workspace, &req.path) {
        Ok(p) => p,
        Err(resp) => return resp,
    };

    match std::fs::read_to_string(&file_path) {
        Ok(content) => {
            let size = content.len();
            let resp = serde_json::json!({ "content": content, "size": size });
            (200, serde_json::to_vec(&resp).unwrap())
        }
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Failed to read: {e}") });
            (404, serde_json::to_vec(&err).unwrap())
        }
    }
}

/// POST /api/workspace/write — write a file to the project workspace.
///
/// Body: `{"project_id": "...", "path": "/notes.md", "content": "..."}`
pub async fn handle_workspace_write(body: &[u8]) -> (u16, Vec<u8>) {
    #[derive(serde::Deserialize)]
    struct Req {
        project_id: String,
        path: String,
        content: String,
    }

    let req: Req = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Invalid request: {e}") });
            return (400, serde_json::to_vec(&err).unwrap());
        }
    };

    let workspace = find_workspace(&req.project_id);
    let file_path = match validate_workspace_path(&workspace, &req.path) {
        Ok(p) => p,
        Err(resp) => return resp,
    };

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            let err = serde_json::json!({ "error": format!("Failed to create directory: {e}") });
            return (500, serde_json::to_vec(&err).unwrap());
        }
    }

    match std::fs::write(&file_path, &req.content) {
        Ok(()) => {
            let resp = serde_json::json!({ "ok": true });
            (200, serde_json::to_vec(&resp).unwrap())
        }
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Failed to write: {e}") });
            (500, serde_json::to_vec(&err).unwrap())
        }
    }
}
