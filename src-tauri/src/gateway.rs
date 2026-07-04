//! Tauri integration for Agentii desktop application.
//! Starts the agentii-gateway as a background tokio task on app launch.

use std::path::Path;
use std::sync::Arc;

/// Start the agentii gateway server as a background task.
/// Called during Tauri app initialization.
pub async fn start_gateway_background(
    config_path: Option<String>,
) -> anyhow::Result<()> {
    // Load config
    let config = match config_path {
        Some(ref path) => agentii_config::load(Path::new(path))?,
        None => agentii_config::load_or_default(Path::new("agentii.toml")),
    };

    let host = config.server.host.clone();
    let port = config.server.port;

    // Create session store
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("agentii");
    std::fs::create_dir_all(&data_dir).ok();
    let db_path = data_dir.join("sessions.db");

    let session_store = Arc::new(
        agentii_sessions::SqliteSessionStore::new(db_path.to_str().unwrap_or("sessions.db"))
            .expect("Failed to create session store"),
    );

    // Create tool registry
    let tool_registry = agentii_tools::ToolRegistry::default();

    // Create gateway state
    let state = agentii_gateway::state::GatewayState::new(config, tool_registry, session_store);

    // Start server in background
    tokio::spawn(async move {
        if let Err(e) = agentii_gateway::server::start_server(state, &host, port).await {
            tracing::error!("Gateway server error: {}", e);
        }
    });

    tracing::info!("Gateway background task spawned");
    Ok(())
}
