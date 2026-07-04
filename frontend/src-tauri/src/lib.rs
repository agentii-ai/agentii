pub mod memory;
pub mod rpc;
pub mod security;

use std::path::PathBuf;
use std::sync::Arc;

use rpc::memory_handlers::{
    memory_create_buffer, memory_list_sessions, memory_list_snapshots, memory_notify_changed,
    memory_push_pty_line, memory_read, memory_read_file, memory_tab_closed, memory_write,
    MemoryState,
};

/// Initialize the memory system: bootstrap directories, inject into CLI files,
/// and build the system prompt. Called during Tauri setup.
fn initialize_memory(workspace_root: &std::path::Path, project_name: &str) {
    // Phase 2 T011: Bootstrap memory structure (directories + skeleton files)
    if let Err(e) = memory::bootstrap::bootstrap_memory_structure(workspace_root, project_name) {
        eprintln!("Memory bootstrap failed: {e}");
    }

    // Phase 2 T012: Inject agentii.md/style.md into all CLI instruction files
    if let Err(e) = memory::inject::inject_all_cli_instruction_files(workspace_root) {
        eprintln!("Memory injection failed: {e}");
    }

    // Phase 2 T013: Build and write the system prompt with memory section
    let system_prompt_dir = workspace_root.join(".agentii");
    let _ = std::fs::create_dir_all(&system_prompt_dir);
    let system_prompt_path = system_prompt_dir.join("system_prompt.md");

    let existing_prompt = std::fs::read_to_string(&system_prompt_path).unwrap_or_default();
    let memory_section = memory::system_prompt::build_memory_system_prompt();

    // Append memory section if not already present
    if !existing_prompt.contains("## Workspace Memory System") {
        let mut full_prompt = existing_prompt;
        if !full_prompt.is_empty() && !full_prompt.ends_with('\n') {
            full_prompt.push('\n');
        }
        full_prompt.push('\n');
        full_prompt.push_str(memory_section);
        if let Err(e) = std::fs::write(&system_prompt_path, full_prompt) {
            eprintln!("Failed to write system prompt: {e}");
        }
    }

    // Validate agentii.md and log warnings
    let warnings = memory::bootstrap::validate_agentii_md(workspace_root);
    for w in &warnings {
        eprintln!("Memory validation warning: {w}");
    }
}

pub fn run() {
    // Default workspace root — overridden by AGENTII_WORKSPACE env var or Tauri setup
    let workspace_root = std::env::var("AGENTII_WORKSPACE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/workspace"));

    let project_name = std::env::var("AGENTII_PROJECT_NAME")
        .unwrap_or_else(|_| "Untitled Project".to_string());

    // Initialize memory system before Tauri starts
    if workspace_root.exists() {
        initialize_memory(&workspace_root, &project_name);
    }

    let session_buffers = Arc::new(memory::session_capture::SessionBufferManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(MemoryState {
            workspace_root,
            project_name,
            session_buffers,
        })
        .invoke_handler(tauri::generate_handler![
            memory_read,
            memory_write,
            memory_notify_changed,
            memory_list_snapshots,
            memory_list_sessions,
            memory_read_file,
            memory_push_pty_line,
            memory_create_buffer,
            memory_tab_closed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
