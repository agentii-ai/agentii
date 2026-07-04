use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use futures::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{Request, Response};
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};

use agentii_protocol::gateway::{RequestFrame, ResponseFrame};
use agentii_protocol::vm::{VmConfig, VmStatus};
use agentii_pty_proxy::pty_manager::PtyManager;
use agentii_pty_proxy::rpc::TerminalRpcHandler;
use agentii_vm::backend::VmBackendTrait;
use agentii_vm::lima::LimaBackend;
use agentii_vm::pool::VmPoolManager;
use agentii_gateway_bridge::GatewayBridge;
use agentii_protocol::gateway::EventFrame;

use crate::auth::{AuthConfig, AuthState};
use crate::chat_proxy;
use crate::router::{GatewayRouter, Route};
use crate::workspace_init;

// ---------------------------------------------------------------------------
// VM status event types
// ---------------------------------------------------------------------------

/// Event emitted to Channel 2 WebSocket clients when VM status changes.
#[derive(Debug, Clone, Serialize)]
pub struct VmStatusEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "vm.status", "cli.readiness_changed", etc.
    pub project_id: String,
    pub status: String, // "booting", "running", "stopped", "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_health: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_image_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_seconds: Option<u64>,
    // CLI readiness fields (only set for cli.readiness_changed events)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tab_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub injected_keys: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

impl VmStatusEvent {
    pub fn new(project_id: impl Into<String>, status: impl Into<String>) -> Self {
        Self {
            event_type: "vm.status".into(),
            project_id: project_id.into(),
            status: status.into(),
            mcp_health: None,
            base_image_version: None,
            uptime_seconds: None,
            tab_id: None,
            cli_id: None,
            injected_keys: None,
            error_message: None,
        }
    }
}

/// Event emitted when a VM finishes booting.
#[derive(Debug, Clone, Serialize)]
pub struct VmBootEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "vm.boot"
    pub project_id: String,
    pub duration_ms: u64,
    pub method: String, // "clone", "resume", "create"
    pub base_image_version: String,
}

/// Event emitted when a VM encounters an error.
#[derive(Debug, Clone, Serialize)]
pub struct VmErrorEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "vm.error"
    pub project_id: String,
    pub error: String,
    pub recoverable: bool,
}

/// Event emitted when a VM is evicted from the pool.
#[derive(Debug, Clone, Serialize)]
pub struct VmEvictEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "vm.evict"
    pub project_id: String,
    pub reason: String, // "lru", "manual", "error"
}

/// Event emitted when MCP tool health changes.
#[derive(Debug, Clone, Serialize)]
pub struct McpHealthEvent {
    #[serde(rename = "type")]
    pub event_type: String, // "mcp.health"
    pub project_id: String,
    pub cli_name: String,
    pub status: String, // "healthy", "down", "restarted"
    pub restart_count: u32,
}

/// Broadcast channel for VM status events sent to all connected Channel 2 clients.
#[derive(Clone)]
pub struct VmEventBus {
    tx: broadcast::Sender<VmStatusEvent>,
}

impl VmEventBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(64);
        Self { tx }
    }

    /// Emit a VM status event to all connected Channel 2 WebSocket clients.
    pub fn emit_vm_status(&self, project_id: &str, status: &str) {
        let event = VmStatusEvent::new(project_id, status);
        // Ignore send error — means no receivers are connected.
        let _ = self.tx.send(event);
    }

    /// Subscribe to VM status events.
    pub fn subscribe(&self) -> broadcast::Receiver<VmStatusEvent> {
        self.tx.subscribe()
    }

    /// Emit a boot-complete event (status transitions to "running").
    pub fn emit_boot(&self, project_id: &str, duration_ms: u64, method: &str, version: &str) {
        let event = VmStatusEvent {
            event_type: "vm.boot".into(),
            project_id: project_id.into(),
            status: "running".into(),
            mcp_health: None,
            base_image_version: Some(version.into()),
            uptime_seconds: Some(0),
            tab_id: None,
            cli_id: None,
            injected_keys: None,
            error_message: None,
        };
        let _ = self.tx.send(event);
        info!(project = %project_id, duration_ms, method, version, "vm.boot emitted");
    }

    /// Emit a VM error event (status transitions to "error").
    pub fn emit_error(&self, project_id: &str, error: &str) {
        let event = VmStatusEvent {
            event_type: "vm.error".into(),
            project_id: project_id.into(),
            status: "error".into(),
            mcp_health: None,
            base_image_version: None,
            uptime_seconds: None,
            tab_id: None,
            cli_id: None,
            injected_keys: None,
            error_message: None,
        };
        let _ = self.tx.send(event);
        warn!(project = %project_id, error, "vm.error emitted");
    }

    /// Emit a VM eviction event (status transitions to "stopped").
    pub fn emit_evict(&self, project_id: &str, reason: &str) {
        let event = VmStatusEvent {
            event_type: "vm.evict".into(),
            project_id: project_id.into(),
            status: "stopped".into(),
            mcp_health: None,
            base_image_version: None,
            uptime_seconds: None,
            tab_id: None,
            cli_id: None,
            injected_keys: None,
            error_message: None,
        };
        let _ = self.tx.send(event);
        info!(project = %project_id, reason, "vm.evict emitted");
    }

    /// Emit an MCP health change event for a specific CLI tool.
    pub fn emit_mcp_health(&self, project_id: &str, cli_name: &str, health: &str) {
        let mut mcp = HashMap::new();
        mcp.insert(cli_name.into(), health.into());
        let event = VmStatusEvent {
            event_type: "mcp.health".into(),
            project_id: project_id.into(),
            status: "running".into(),
            mcp_health: Some(mcp),
            base_image_version: None,
            uptime_seconds: None,
            tab_id: None,
            cli_id: None,
            injected_keys: None,
            error_message: None,
        };
        let _ = self.tx.send(event);
        info!(project = %project_id, cli_name, health, "mcp.health emitted");
    }
}

/// The main gateway server that accepts WebSocket connections and routes them.
///
/// T038: Watches `~/.agentii/config/mcp-tools.json` for changes and pushes
/// updated MCP config to all running VMs via the pool's provisioner.
/// Allowed WebSocket origins for origin validation.
/// Checked by extracting scheme://host from the Origin header.
const ALLOWED_WS_ORIGINS: &[&str] = &[
    "http://localhost",
    "http://127.0.0.1",
    "https://localhost",
    "https://127.0.0.1",
    "tauri://localhost",
];

/// Check if an Origin header value matches the allowlist.
/// Parses the origin to extract scheme://host (ignoring port and path)
/// to prevent prefix attacks like `http://localhost.evil.com`.
fn is_origin_allowed(origin: &str) -> bool {
    // Extract scheme://host from the origin, stripping port and path.
    // Origin format: "scheme://host[:port]"
    let scheme_host = if let Some(idx) = origin.find("://") {
        let after_scheme = &origin[idx + 3..];
        // Strip port (:NNNN) and path (/...) — take up to first ':' or '/'
        let host_end = after_scheme
            .find(|c: char| c == ':' || c == '/')
            .unwrap_or(after_scheme.len());
        let host = &after_scheme[..host_end];
        let scheme = &origin[..idx];
        format!("{}://{}", scheme, host)
    } else {
        return false; // Malformed origin — no scheme
    };

    ALLOWED_WS_ORIGINS.iter().any(|allowed| scheme_host == *allowed)
}

pub struct GatewayServer {
    pub router: GatewayRouter,
    pub bind_addr: SocketAddr,
    pub terminal_rpc: Arc<TerminalRpcHandler>,
    pub pty_manager: Arc<PtyManager>,
    pub deepseek_api_key: String,
    pub vm_event_bus: Arc<VmEventBus>,
    /// VM pool manager — None when Lima is not available (host PTY fallback).
    pub vm_pool: Option<Arc<VmPoolManager>>,
    /// Auth state for JWT validation.
    pub auth: AuthState,
}

impl GatewayServer {
    /// Create a new gateway server. Detects Lima availability and conditionally
    /// initializes the VM pool manager.
    pub async fn new(port: u16, pty_manager: Arc<PtyManager>) -> Self {
        let bind_addr = SocketAddr::from(([127, 0, 0, 1], port));
        let deepseek_api_key = std::env::var("DEEPSEEK_API_KEY").unwrap_or_default();

        // Detect Lima availability and init VM pool
        let vm_pool = Self::try_init_vm_pool().await;

        // Init auth state
        let dev_mode = std::env::var("AGENTII_DEV_MODE").is_ok();
        let jwt_secret = std::env::var("SUPABASE_JWT_SECRET").unwrap_or_default();
        let auth = AuthState::new(AuthConfig {
            jwt_secret,
            skip_validation: dev_mode,
        });
        if dev_mode {
            info!("Auth: dev mode enabled (validation skipped)");
        }

        Self {
            router: GatewayRouter::new(port),
            bind_addr,
            terminal_rpc: Arc::new(TerminalRpcHandler::new(String::new(), pty_manager.clone())),
            pty_manager,
            deepseek_api_key,
            vm_event_bus: Arc::new(VmEventBus::new()),
            vm_pool,
            auth,
        }
    }

    /// Try to initialize the VM pool with Lima backend.
    /// Returns None if Lima is not installed.
    async fn try_init_vm_pool() -> Option<Arc<VmPoolManager>> {
        // Resolve the Lima template path from the agentii-vm crate's templates directory.
        let template_path = {
            let manifest_dir = env!("CARGO_MANIFEST_DIR");
            PathBuf::from(manifest_dir)
                .join("../agentii-vm/templates/agentii-base.yaml")
        };
        let lima = LimaBackend::new(template_path);
        if !lima.is_available().await {
            info!("Lima not detected — VM isolation disabled, using host PTY fallback");
            return None;
        }

        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let state_path = PathBuf::from(format!("{home}/.agentii/vm-state"));
        let _ = std::fs::create_dir_all(&state_path);

        let pool = VmPoolManager::new(Arc::new(lima), state_path, None);
        info!("VM pool manager initialized with Lima backend");
        Some(Arc::new(pool))
    }

    pub fn with_terminal_rpc(mut self, rpc: Arc<TerminalRpcHandler>) -> Self {
        self.terminal_rpc = rpc;
        self
    }

    /// T038: Spawn a background task that watches `~/.agentii/config/mcp-tools.json`
    /// for changes. When the file is modified, logs the event so the pool manager
    /// can re-provision MCP configs on running VMs.
    ///
    /// Uses `notify` with a 2-second debounce to avoid rapid re-provisioning.
    fn spawn_mcp_config_watcher() {
        use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
        use std::path::PathBuf;
        use std::time::Duration;

        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let config_path = PathBuf::from(&home).join(".agentii/config/mcp-tools.json");
        let watch_dir = PathBuf::from(&home).join(".agentii/config");

        // Create the config directory if it doesn't exist so the watcher has
        // something to attach to.
        let _ = std::fs::create_dir_all(&watch_dir);

        tokio::task::spawn_blocking(move || {
            let (tx, rx) = std::sync::mpsc::channel();

            let mut debouncer = match new_debouncer(Duration::from_secs(2), tx) {
                Ok(d) => d,
                Err(e) => {
                    warn!(error = %e, "Failed to create MCP config file watcher");
                    return;
                }
            };

            if let Err(e) = debouncer
                .watcher()
                .watch(&watch_dir, notify::RecursiveMode::NonRecursive)
            {
                warn!(path = %watch_dir.display(), error = %e, "Failed to watch MCP config directory");
                return;
            }

            info!(path = %config_path.display(), "MCP config file watcher started (2s debounce)");

            loop {
                match rx.recv() {
                    Ok(Ok(events)) => {
                        let relevant = events.iter().any(|e| {
                            e.kind == DebouncedEventKind::Any
                                && e.path.file_name().map(|n| n == "mcp-tools.json").unwrap_or(false)
                        });
                        if relevant {
                            info!("MCP config file changed — VMs will pick up new config on next provision cycle");
                            // The actual re-provisioning happens lazily: the next
                            // time a VM boots or a terminal tab opens, the pool
                            // calls provision_merged_mcp() which reads the latest
                            // global config. For already-running VMs, the gateway
                            // RPC handler can trigger re-provision on demand.
                        }
                    }
                    Ok(Err(err)) => {
                        warn!(error = %err, "MCP config watcher error");
                    }
                    Err(_) => {
                        info!("MCP config watcher channel closed, stopping");
                        break;
                    }
                }
            }
        });
    }

    /// Start the gateway server. Runs until cancelled.
    pub async fn run(&self) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(self.bind_addr).await?;
        info!(addr = %self.bind_addr, "Gateway server listening");

        if self.deepseek_api_key.is_empty() {
            warn!("DEEPSEEK_API_KEY not set — /api/chat/setup will return 503");
        } else {
            info!("DEEPSEEK_API_KEY configured for chat proxy");
        }

        if self.vm_pool.is_some() {
            info!("VM isolation: ENABLED (Lima)");
        } else {
            warn!("VM isolation: DISABLED (host PTY fallback with env sanitization)");
        }

        // T038: Spawn background MCP config file watcher
        Self::spawn_mcp_config_watcher();

        loop {
            let (stream, peer_addr) = listener.accept().await?;
            info!(peer = %peer_addr, "New connection");

            let terminal_rpc = self.terminal_rpc.clone();
            let pty_manager = self.pty_manager.clone();
            let api_key = self.deepseek_api_key.clone();
            let vm_event_bus = self.vm_event_bus.clone();
            let vm_pool = self.vm_pool.clone();
            let auth = self.auth.clone();
            tokio::spawn(async move {
                if let Err(e) =
                    Self::handle_connection(
                        stream, peer_addr, terminal_rpc, pty_manager,
                        api_key, vm_event_bus, vm_pool, auth,
                    ).await
                {
                    warn!(peer = %peer_addr, error = %e, "Connection handler error");
                }
            });
        }
    }

    async fn handle_connection(
        mut stream: TcpStream,
        peer_addr: SocketAddr,
        terminal_rpc: Arc<TerminalRpcHandler>,
        pty_manager: Arc<PtyManager>,
        api_key: String,
        vm_event_bus: Arc<VmEventBus>,
        vm_pool: Option<Arc<VmPoolManager>>,
        auth: AuthState,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Peek at the first bytes to determine if this is an HTTP API request
        // or a WebSocket upgrade. We read the request line to extract method + path.
        let mut peek_buf = [0u8; 4096];
        let n = stream.peek(&mut peek_buf).await?;
        let peek_str = String::from_utf8_lossy(&peek_buf[..n]);

        // Parse the HTTP request line: "METHOD /path HTTP/1.1\r\n"
        if let Some(request_line) = peek_str.lines().next() {
            let parts: Vec<&str> = request_line.split_whitespace().collect();
            if parts.len() >= 2 {
                let method = parts[0];
                let path = parts[1];

                // Route /api/* paths as plain HTTP (not WebSocket)
                if path.starts_with("/api/") {
                    // Extract Authorization header for auth check
                    let headers_str = peek_str.to_string();
                    return Self::handle_http_request(
                        &mut stream, peer_addr, method, path, &api_key, &auth, &headers_str,
                    ).await;
                }

                // Handle CORS preflight for /api/* paths
                if method == "OPTIONS" && path.starts_with("/api/") {
                    let headers_str = peek_str.to_string();
                    return Self::handle_http_request(
                        &mut stream, peer_addr, method, path, &api_key, &auth, &headers_str,
                    ).await;
                }
            }
        }

        // Not an API request — proceed with WebSocket upgrade
        let mut request_path = String::new();
        let mut origin_rejected = false;

        let ws_stream = accept_hdr_async(stream, |req: &Request, resp: Response| {
            request_path = req.uri().path_and_query().map(|pq| pq.to_string()).unwrap_or_else(|| req.uri().path().to_string());

            // Phase 4B: Origin validation on WebSocket upgrade
            if let Some(origin) = req.headers().get("origin").and_then(|v| v.to_str().ok()) {
                if !is_origin_allowed(origin) {
                    warn!(origin = %origin, "WebSocket connection rejected: unknown origin");
                    origin_rejected = true;
                }
            }
            // No Origin header is OK (same-origin requests, CLI tools, etc.)

            Ok(resp)
        })
        .await?;

        if origin_rejected {
            let (mut sink, _) = ws_stream.split();
            let _ = sink.close().await;
            return Ok(());
        }

        let route = Route::from_path(&request_path);

        match route {
            Route::Terminal { project_id, terminal_id, cli_id, term_override } => {
                info!(peer = %peer_addr, project = %project_id, terminal = %terminal_id, cli = ?cli_id, term = ?term_override, "Terminal WebSocket connected");
                Self::handle_terminal_ws(
                    ws_stream, &project_id, &terminal_id, cli_id.as_deref(),
                    term_override.as_deref(),
                    terminal_rpc, pty_manager, vm_pool, &vm_event_bus,
                ).await;
            }
            Route::Agent => {
                info!(peer = %peer_addr, "Agent WebSocket connected");
                Self::handle_agent_ws(ws_stream, vm_event_bus, vm_pool.clone(), pty_manager.clone()).await;
            }
            Route::Chat => {
                info!(peer = %peer_addr, "Chat WebSocket connected");
                Self::handle_agent_ws(ws_stream, vm_event_bus, vm_pool.clone(), pty_manager.clone()).await;
            }
            Route::NotFound(path) => {
                warn!(peer = %peer_addr, path = %path, "Unknown WebSocket route");
                let (mut sink, _) = ws_stream.split();
                let _ = sink.close().await;
            }
        }

        Ok(())
    }

    /// Handle a plain HTTP request (non-WebSocket).
    /// Reads the full HTTP request from the stream, dispatches to the appropriate handler,
    /// and writes the HTTP response back.
    async fn handle_http_request(
        stream: &mut TcpStream,
        peer_addr: SocketAddr,
        method: &str,
        path: &str,
        api_key: &str,
        auth: &AuthState,
        raw_headers: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Read the full HTTP request
        let mut buf = vec![0u8; 65536];
        let mut total_read = 0;

        // Read until we have the full headers (look for \r\n\r\n)
        loop {
            let n = stream.read(&mut buf[total_read..]).await?;
            if n == 0 {
                return Ok(());
            }
            total_read += n;

            if let Some(header_end) = find_header_end(&buf[..total_read]) {
                // Parse Content-Length to read the body
                let headers_str = String::from_utf8_lossy(&buf[..header_end]);
                let content_length = parse_content_length(&headers_str);
                let body_start = header_end + 4; // skip \r\n\r\n
                let body_received = total_read - body_start;

                if body_received < content_length {
                    // Need to read more body bytes
                    if body_start + content_length > buf.len() {
                        buf.resize(body_start + content_length, 0);
                    }
                    let mut body_read = body_received;
                    while body_read < content_length {
                        let n = stream.read(&mut buf[body_start + body_read..body_start + content_length]).await?;
                        if n == 0 {
                            break;
                        }
                        body_read += n;
                    }
                    total_read = body_start + body_read;
                }

                let body = &buf[body_start..body_start + content_length.min(total_read - body_start)];

                // Handle OPTIONS preflight
                if method == "OPTIONS" {
                    let response = format!(
                        "HTTP/1.1 204 No Content\r\n\
                         Access-Control-Allow-Origin: *\r\n\
                         Access-Control-Allow-Methods: POST, OPTIONS\r\n\
                         Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
                         Access-Control-Max-Age: 86400\r\n\
                         Content-Length: 0\r\n\
                         \r\n"
                    );
                    stream.write_all(response.as_bytes()).await?;
                    return Ok(());
                }

                // Phase 4C: Auth on HTTP endpoints
                // Validate tokens when present (catches invalid/expired tokens).
                // The gateway binds to 127.0.0.1 only — localhost connections are
                // implicitly trusted. Auth enforcement for non-localhost listeners
                // will be added when the gateway supports remote access.
                if let Some(token) = extract_authorization_header(raw_headers) {
                    if let Err(_) = auth.validate_token(&token) {
                        let err = serde_json::json!({ "error": "Unauthorized" });
                        let body = serde_json::to_vec(&err).unwrap();
                        write_http_response(stream, 401, &body).await?;
                        return Ok(());
                    }
                }

                // Route to handler
                if method == "POST" && path == "/api/chat/setup" {
                    info!(peer = %peer_addr, "HTTP POST /api/chat/setup");
                    let (status, response_body) = chat_proxy::handle_chat_setup(api_key, body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/workspace/init" {
                    info!(peer = %peer_addr, "HTTP POST /api/workspace/init");
                    let (status, response_body) = workspace_init::handle_workspace_init(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/workspace/files" {
                    info!(peer = %peer_addr, "HTTP POST /api/workspace/files");
                    let (status, response_body) = workspace_init::handle_workspace_files(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/workspace/read" {
                    info!(peer = %peer_addr, "HTTP POST /api/workspace/read");
                    let (status, response_body) = workspace_init::handle_workspace_read(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/workspace/write" {
                    info!(peer = %peer_addr, "HTTP POST /api/workspace/write");
                    let (status, response_body) = workspace_init::handle_workspace_write(body).await;
                    write_http_response(stream, status, &response_body).await?;
                // --- Extension settings RPC endpoints ---
                } else if method == "POST" && path == "/api/settings/skills/list" {
                    info!(peer = %peer_addr, "HTTP POST /api/settings/skills/list");
                    let (status, response_body) = crate::rpc_extensions::handle_skills_list(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/settings/skills/configure" {
                    info!(peer = %peer_addr, "HTTP POST /api/settings/skills/configure");
                    let (status, response_body) = crate::rpc_extensions::handle_skills_configure(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/settings/skills/toggle" {
                    info!(peer = %peer_addr, "HTTP POST /api/settings/skills/toggle");
                    let (status, response_body) = crate::rpc_extensions::handle_skills_toggle(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/settings/mcp/list" {
                    info!(peer = %peer_addr, "HTTP POST /api/settings/mcp/list");
                    let (status, response_body) = crate::rpc_extensions::handle_mcp_list(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/settings/mcp/configure" {
                    info!(peer = %peer_addr, "HTTP POST /api/settings/mcp/configure");
                    let (status, response_body) = crate::rpc_extensions::handle_mcp_configure(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else if method == "POST" && path == "/api/settings/mcp/toggle" {
                    info!(peer = %peer_addr, "HTTP POST /api/settings/mcp/toggle");
                    let (status, response_body) = crate::rpc_extensions::handle_mcp_toggle(body).await;
                    write_http_response(stream, status, &response_body).await?;
                } else {
                    let err = serde_json::json!({ "error": format!("Not found: {method} {path}") });
                    let body = serde_json::to_vec(&err).unwrap();
                    write_http_response(stream, 404, &body).await?;
                }

                return Ok(());
            }

            if total_read >= buf.len() {
                // Headers too large
                let err = b"HTTP/1.1 431 Request Header Fields Too Large\r\nContent-Length: 0\r\n\r\n";
                stream.write_all(err).await?;
                return Ok(());
            }
        }
    }

    // -------------------------------------------------------------------
    // T024: spawn_cli_in_vm — full PTY spawn sequence with key injection
    // -------------------------------------------------------------------

    /// Spawn a CLI agent inside the VM with full provisioning.
    ///
    /// Sequence (per contracts/cli-provisioning.md section 2):
    /// 1. Collect API keys from OS keychain
    /// 2. CliKeyMapper::env_for_cli() to build env var set
    /// 3. Read per-project provider overrides
    /// 4. reprovision_cli_config() — self-healing config write
    /// 5. Reprovision system prompt if missing
    /// 6. Spawn PTY with injected env vars
    /// 7. Emit cli.readiness_changed event
    async fn spawn_cli_in_vm(
        pty_manager: &PtyManager,
        vm_pool: &Option<Arc<VmPoolManager>>,
        vm_event_bus: &VmEventBus,
        project_id: &str,
        terminal_id: &str,
        cli_id: &str,
        term_override: Option<&str>,
    ) -> Result<(), String> {
        info!(project = %project_id, terminal = %terminal_id, cli = %cli_id, "Spawning CLI in VM");
        let workspace_cwd = workspace_init::find_workspace(project_id);

        // Step 1-2: Collect keys and build env var set
        let key_mapper = agentii_vm::keys::CliKeyMapper::from_keychain().await;
        let env_vars = key_mapper.env_for_cli(cli_id);
        let injected_keys: Vec<String> = env_vars.keys().cloned().collect();

        // Step 3: Read per-project overrides (if VM available)
        // For host fallback, overrides come from the workspace config.toml
        let config_toml_path = workspace_cwd.join(".agentii/config.toml");
        let _overrides = if config_toml_path.exists() {
            std::fs::read_to_string(&config_toml_path)
                .ok()
                .and_then(|c| agentii_vm::keys::parse_project_overrides(&c))
        } else {
            None
        };

        // Step 4: Reprovision CLI config (self-healing)
        if let Some(ref pool) = vm_pool {
            let vm_name = format!("agentii-{}", &project_id[..project_id.len().min(12)]);
            let global_mcp = agentii_vm::mcp_config::load_global_config().await;
            // Use merge_configs() to resolve user-configured env vars from the registry
            // into each tool's env map (e.g., EDGAR_COMPANY_NAME → edgartools.env)
            let tools = agentii_vm::mcp_config::merge_configs(&global_mcp, None);
            let backend = pool.backend();
            let _ = agentii_vm::provisioner::reprovision_cli_config(
                backend.as_ref(), &vm_name, cli_id, &tools,
            ).await;
        }

        // Step 5: Build env for PTY spawn
        let profile = agentii_vm::cli_registry::get_profile(cli_id);
        let (command, args) = if let Some(p) = profile {
            (p.launch_command.as_str(), p.launch_args.as_slice())
        } else {
            (cli_id, &[] as &[String])
        };

        // Step 6: Spawn PTY
        let env_pairs: Vec<(&str, &str)> = env_vars
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();

        let mut all_env: Vec<(&str, &str)> = env_pairs.clone();
        all_env.push(("AGENTII_PROJECT_ID", project_id));
        all_env.push(("AGENTII_WORKSPACE", "/workspace"));
        // Use TERM override from frontend (e.g., "xterm" for goose/reedline)
        let term_value = term_override.unwrap_or("xterm-256color");
        all_env.push(("TERM", term_value));

        let workspace_str = workspace_cwd.to_string_lossy().to_string();

        // If VM is available, spawn via limactl shell; otherwise host PTY
        let spawn_result = if let Some(pool) = vm_pool {
            // Ensure VM is running
            let vm_config = VmConfig::default();
            match pool.get_or_boot(project_id, workspace_cwd.clone(), vm_config).await {
                Ok(vm_name) => {
                    info!(project = %project_id, vm = %vm_name, "VM ready for CLI spawn");
                    vm_event_bus.emit_vm_status(project_id, "running");
                    let mut lima_args = vec!["shell", &vm_name, "--"];
                    let cmd_str = command;
                    lima_args.push(cmd_str);
                    for a in args {
                        lima_args.push(a.as_str());
                    }
                    pty_manager
                        .spawn_with_args_and_env(
                            terminal_id, "limactl", &lima_args,
                            &workspace_str, 80, 24, &all_env, false,
                        )
                        .await
                }
                Err(e) => {
                    warn!(project = %project_id, error = %e, "VM boot failed for CLI, falling back to host PTY");
                    // Provision MCP config on host before spawning
                    let global_mcp = agentii_vm::mcp_config::load_global_config().await;
                    let overrides = agentii_vm::mcp_config::load_project_overrides(&workspace_cwd).await;
                    let tools = agentii_vm::mcp_config::merge_configs(&global_mcp, overrides.as_ref());
                    let cli_id_owned = cli_id.to_string();
                    let ws = workspace_cwd.clone();
                    if let Err(e) = tokio::task::spawn_blocking(move || {
                        agentii_vm::provisioner::reprovision_cli_config_host(&cli_id_owned, &tools, &ws)
                    }).await.unwrap_or_else(|e| Err(std::io::Error::new(std::io::ErrorKind::Other, e))) {
                        warn!(cli = %cli_id, error = %e, "Failed to provision MCP config on host (non-fatal)");
                    }
                    // Fall back to host PTY
                    let arg_strs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
                    pty_manager
                        .spawn_with_args_and_env(
                            terminal_id, command, &arg_strs,
                            &workspace_str, 80, 24, &all_env, false,
                        )
                        .await
                }
            }
        } else {
            // No VM pool — provision MCP config on host before spawning
            let global_mcp = agentii_vm::mcp_config::load_global_config().await;
            let overrides = agentii_vm::mcp_config::load_project_overrides(&workspace_cwd).await;
            let tools = agentii_vm::mcp_config::merge_configs(&global_mcp, overrides.as_ref());
            let cli_id_owned = cli_id.to_string();
            let ws = workspace_cwd.clone();
            if let Err(e) = tokio::task::spawn_blocking(move || {
                agentii_vm::provisioner::reprovision_cli_config_host(&cli_id_owned, &tools, &ws)
            }).await.unwrap_or_else(|e| Err(std::io::Error::new(std::io::ErrorKind::Other, e))) {
                warn!(cli = %cli_id, error = %e, "Failed to provision MCP config on host (non-fatal)");
            }
            // Use host PTY
            let arg_strs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            pty_manager
                .spawn_with_args_and_env(
                    terminal_id, command, &arg_strs,
                    &workspace_str, 80, 24, &all_env, false,
                )
                .await
        };

        // Step 7: Emit readiness event
        match spawn_result {
            Ok(()) => {
                let state = if injected_keys.is_empty() && cli_id != "bash" {
                    "no-keys"
                } else {
                    "ready"
                };
                Self::emit_cli_readiness_changed(
                    vm_event_bus, terminal_id, cli_id, state,
                    &injected_keys, None,
                );
                Ok(())
            }
            Err(e) => {
                let err_msg = format!("{e}");
                error!(project = %project_id, terminal = %terminal_id, cli = %cli_id, error = %err_msg, "Failed to spawn CLI in VM");
                Self::emit_cli_readiness_changed(
                    vm_event_bus, terminal_id, cli_id, "error",
                    &[], Some(&err_msg),
                );
                Err(err_msg)
            }
        }
    }

    // -------------------------------------------------------------------
    // T057: Emit cli.readiness_changed event via Channel 2
    // -------------------------------------------------------------------

    /// Emit a cli.readiness_changed event to all Channel 2 clients.
    fn emit_cli_readiness_changed(
        vm_event_bus: &VmEventBus,
        tab_id: &str,
        cli_id: &str,
        state: &str,
        injected_keys: &[String],
        error_message: Option<&str>,
    ) {
        let event = VmStatusEvent {
            event_type: "cli.readiness_changed".into(),
            project_id: String::new(),
            status: state.into(),
            mcp_health: None,
            base_image_version: None,
            uptime_seconds: None,
            tab_id: Some(tab_id.into()),
            cli_id: Some(cli_id.into()),
            injected_keys: Some(injected_keys.to_vec()),
            error_message: error_message.map(|s| s.into()),
        };
        info!(
            tab_id = %tab_id,
            cli_id = %cli_id,
            state = %state,
            "cli.readiness_changed emitted"
        );
        // Broadcast via the event bus — the event_forwarder task in handle_agent_ws
        // will wrap in RpcEvent format and forward to all connected Channel 2 clients.
        let _ = vm_event_bus.tx.send(event);
    }

    // -------------------------------------------------------------------
    // T037/T064: cli.list_installed RPC handler
    // -------------------------------------------------------------------

    /// Handle cli.list_installed RPC — query VM for installed CLIs.
    async fn handle_cli_list_installed(
        vm_pool: &Option<Arc<VmPoolManager>>,
        project_id: &str,
    ) -> serde_json::Value {
        if let Some(ref pool) = vm_pool {
            let vm_name = format!("agentii-{}", &project_id[..project_id.len().min(12)]);
            let backend = pool.backend();
            match agentii_vm::cli_install::detect_installed_clis(backend.as_ref(), &vm_name).await {
                Ok(profiles) => {
                    let installed: Vec<serde_json::Value> = profiles.iter()
                        .filter(|p| p.installed)
                        .map(|p| serde_json::json!({
                            "id": p.name,
                            "display_name": p.display_name,
                            "version": null,
                        }))
                        .collect();
                    let missing: Vec<String> = profiles.iter()
                        .filter(|p| !p.installed)
                        .map(|p| p.name.clone())
                        .collect();
                    serde_json::json!({
                        "installed": installed,
                        "missing": missing,
                    })
                }
                Err(e) => {
                    warn!(error = %e, "cli.list_installed failed");
                    // Fallback: return all known CLIs from static registry
                    let all = agentii_vm::cli_registry::all_profiles();
                    let installed: Vec<serde_json::Value> = all.iter()
                        .map(|p| serde_json::json!({
                            "id": p.id,
                            "display_name": p.display_name,
                            "version": null,
                        }))
                        .collect();
                    serde_json::json!({
                        "installed": installed,
                        "missing": [],
                    })
                }
            }
        } else {
            // No VM — return all CLIs as "installed" (host fallback)
            let all = agentii_vm::cli_registry::all_profiles();
            let installed: Vec<serde_json::Value> = all.iter()
                .map(|p| serde_json::json!({
                    "id": p.id,
                    "display_name": p.display_name,
                    "version": null,
                }))
                .collect();
            serde_json::json!({
                "installed": installed,
                "missing": [],
            })
        }
    }

    /// Handle a terminal WebSocket connection.
    ///
    /// The frontend connects to `/ws/terminal/{project_id}/{terminal_id}`.
    /// The PTY is spawned eagerly with cwd set to the project workspace directory
    /// (`~/.agentii/workspaces/{project_id}/`), which is auto-created if missing.
    ///
    /// - Binary frames → PTY stdin (keystrokes)
    /// - PTY stdout → binary WebSocket frames (output)
    /// - Text frames → JSON-RPC dispatch (terminal.resize, terminal.close, etc.)
    async fn handle_terminal_ws(
        ws_stream: tokio_tungstenite::WebSocketStream<TcpStream>,
        project_id: &str,
        terminal_id: &str,
        cli_id: Option<&str>,
        term_override: Option<&str>,
        terminal_rpc: Arc<TerminalRpcHandler>,
        pty_manager: Arc<PtyManager>,
        vm_pool: Option<Arc<VmPoolManager>>,
        vm_event_bus: &VmEventBus,
    ) {
        let tid = terminal_id.to_string();

        // Bump the connection epoch so deferred disconnect cleanup can detect
        // whether a newer WebSocket has reattached for this terminal_id.
        let connection_epoch = pty_manager.bump_epoch(&tid).await;

        // Resolve project workspace directory — search across all user directories
        // since the scaffold creates workspaces at workspaces/{user_id}/{project_id}/
        // but the terminal handler doesn't know the user_id.
        let workspace_cwd = workspace_init::find_workspace(project_id);
        let workspace_str = workspace_cwd.to_string_lossy().to_string();

        // Wait up to 3 seconds for agentii.md to appear (scaffold may still be in-flight)
        let agentii_md_path = workspace_cwd.join("agentii.md");
        for attempt in 0..6 {
            if agentii_md_path.exists() {
                break;
            }
            if attempt == 0 {
                // First attempt: ensure directory exists at minimum
                let _ = workspace_init::init_workspace(&workspace_cwd, None);
            }
            info!(project = %project_id, attempt, "Waiting for workspace scaffold to complete...");
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        if !workspace_cwd.exists() {
            let _ = workspace_init::init_workspace(&workspace_cwd, None);
        }

        info!(
            project = %project_id,
            path = %workspace_str,
            agentii_md = agentii_md_path.exists(),
            "Workspace ready for terminal"
        );

        // Phase 1B: Fork terminal handler — VM path vs host PTY fallback
        //
        // IMPORTANT: Do NOT block the WebSocket handler on VM boot (limactl create+start
        // can take 30+ seconds). Instead, check if the VM is already running. If not,
        // fall back to host PTY immediately and kick off VM boot in the background
        // so future tabs can use the VM.
        let using_vm = if let Some(ref pool) = vm_pool {
            // Fast path: check if VM is already running (instant, no blocking)
            if let Some(vm_name) = pool.try_get_running(project_id).await {
                info!(project = %project_id, vm = %vm_name, "VM already running for terminal");
                vm_event_bus.emit_vm_status(project_id, "running");
                // If cli_id is provided, spawn CLI via spawn_cli_in_vm
                if let Some(cli) = cli_id {
                    match Self::spawn_cli_in_vm(&pty_manager, &vm_pool, vm_event_bus, project_id, terminal_id, cli, term_override).await {
                        Ok(()) => true,
                        Err(e) => {
                            warn!(project = %project_id, error = %e, "Failed to spawn CLI via VM, falling back to host");
                            false
                        }
                    }
                } else {
                    // Spawn PTY via `limactl shell <vm_name> -- bash -l`
                    match pty_manager.spawn_with_args_and_env(
                        &tid, "limactl",
                        &["shell", &vm_name, "--", "bash", "-l"],
                        &workspace_str, 80, 24,
                        &[
                            ("AGENTII_PROJECT_ID", project_id),
                            ("AGENTII_WORKSPACE", "/workspace"),
                        ],
                        false,
                    ).await {
                        Ok(()) => true,
                        Err(e) => {
                            warn!(project = %project_id, error = %e, "Failed to spawn VM PTY, falling back to host");
                            false
                        }
                    }
                }
            } else {
                // VM not running yet — kick off boot in background, use host PTY now
                info!(project = %project_id, "VM not ready, using host PTY fallback (VM boot in background)");
                vm_event_bus.emit_vm_status(project_id, "booting");
                let pool_clone = pool.clone();
                let ws_clone = workspace_cwd.clone();
                let pid = project_id.to_string();
                let bus = vm_event_bus.clone();
                tokio::spawn(async move {
                    let vm_config = VmConfig::default();
                    match pool_clone.get_or_boot(&pid, ws_clone, vm_config).await {
                        Ok(vm_name) => {
                            info!(project = %pid, vm = %vm_name, "Background VM boot completed");
                            bus.emit_vm_status(&pid, "running");
                        }
                        Err(e) => {
                            warn!(project = %pid, error = %e, "Background VM boot failed");
                        }
                    }
                });
                false // Use host PTY for this tab
            }
        } else {
            false
        };

        if !using_vm {
            // Host PTY fallback path with env sanitization (Phase 3)
            let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
            let real_home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());

            // Determine the actual command to spawn: if a CLI was requested and
            // it's available on the host, use it instead of a bare shell.
            let (spawn_command, spawn_args): (String, Vec<String>) = if let Some(cli) = cli_id {
                let profile = agentii_vm::cli_registry::get_profile(cli);
                if let Some(p) = profile {
                    // Check if the CLI binary exists on the host
                    let which_result = tokio::process::Command::new("which")
                        .arg(&p.launch_command)
                        .output()
                        .await;
                    if which_result.map(|o| o.status.success()).unwrap_or(false) {
                        info!(cli = %cli, command = %p.launch_command, "Using host CLI for fallback");
                        (p.launch_command.clone(), p.launch_args.clone())
                    } else {
                        warn!(cli = %cli, "CLI not found on host, falling back to shell");
                        (default_shell.clone(), Vec::new())
                    }
                } else {
                    (default_shell.clone(), Vec::new())
                }
            } else {
                (default_shell.clone(), Vec::new())
            };

            // Provision MCP config on host before spawning CLI
            if let Some(cli) = cli_id {
                let global_mcp = agentii_vm::mcp_config::load_global_config().await;
                let overrides = agentii_vm::mcp_config::load_project_overrides(&workspace_cwd).await;
                let tools = agentii_vm::mcp_config::merge_configs(&global_mcp, overrides.as_ref());
                let cli_owned = cli.to_string();
                let ws = workspace_cwd.clone();
                if let Err(e) = tokio::task::spawn_blocking(move || {
                    agentii_vm::provisioner::reprovision_cli_config_host(&cli_owned, &tools, &ws)
                }).await.unwrap_or_else(|e| Err(std::io::Error::new(std::io::ErrorKind::Other, e))) {
                    warn!(cli = %cli, error = %e, "Failed to provision MCP config on host (non-fatal)");
                }
            }

            // Collect API keys for CLI env injection (host fallback)
            let key_mapper = agentii_vm::keys::CliKeyMapper::from_keychain().await;
            let cli_env_vars = if let Some(cli) = cli_id {
                key_mapper.env_for_cli(cli)
            } else {
                HashMap::new()
            };

            // Create a per-project ZDOTDIR with a custom .zshrc
            let zdotdir = format!("{}/.agentii/zdotdir/{}", real_home, project_id);
            let _ = std::fs::create_dir_all(&zdotdir);

            let mut zshrc = String::new();
            zshrc.push_str("# Agentii workspace shell config — auto-generated\n");
            zshrc.push_str("# Source the user's real zshrc for conda, PATH, aliases, etc.\n");
            zshrc.push_str("if [[ -f \"");
            zshrc.push_str(&real_home);
            zshrc.push_str("/.zshrc\" ]]; then\n");
            zshrc.push_str("  AGENTII_SOURCING=1 source \"");
            zshrc.push_str(&real_home);
            zshrc.push_str("/.zshrc\" 2>/dev/null\n");
            zshrc.push_str("fi\n");
            zshrc.push_str("# Override prompt to show 'workspace' instead of UUID\n");
            zshrc.push_str("PROMPT='%F{cyan}workspace%f %# '\n");
            zshrc.push_str("# Workspace confinement — prevent cd outside workspace\n");
            zshrc.push_str("# AGENTII_WS = real host path (for confinement checks)\n");
            zshrc.push_str("AGENTII_WS='");
            zshrc.push_str(&workspace_str);
            zshrc.push_str("'\n");
            zshrc.push_str("# Virtual path shown to CLI agents (matches Lima VM mount)\n");
            zshrc.push_str("AGENTII_WS_VIRTUAL='/workspace'\n");
            zshrc.push_str("export AGENTII_WORKSPACE='/workspace'\n");
            // cd wrapper: resolve the target, check it's inside the workspace
            zshrc.push_str("agentii_cd() {\n");
            zshrc.push_str("  if [[ $# -eq 0 ]]; then\n");
            zshrc.push_str("    builtin cd \"$AGENTII_WS\"\n");
            zshrc.push_str("    return\n");
            zshrc.push_str("  fi\n");
            // Translate /workspace paths to real paths for the OS
            zshrc.push_str("  local arg=\"$1\"\n");
            zshrc.push_str("  if [[ \"$arg\" == /workspace* ]]; then\n");
            zshrc.push_str("    arg=\"${AGENTII_WS}${arg#/workspace}\"\n");
            zshrc.push_str("  fi\n");
            zshrc.push_str("  local target\n");
            zshrc.push_str("  target=$(builtin cd \"$arg\" 2>/dev/null && pwd -P)\n");
            zshrc.push_str("  if [[ -z \"$target\" ]]; then\n");
            zshrc.push_str("    echo \"cd: no such directory: $1\" >&2\n");
            zshrc.push_str("    return 1\n");
            zshrc.push_str("  fi\n");
            zshrc.push_str("  if [[ \"$target\" != \"$AGENTII_WS\"* ]]; then\n");
            zshrc.push_str("    echo \"\\033[33m⚠ Cannot navigate outside workspace\\033[0m\" >&2\n");
            zshrc.push_str("    return 1\n");
            zshrc.push_str("  fi\n");
            zshrc.push_str("  builtin cd \"$arg\"\n");
            zshrc.push_str("}\n");
            zshrc.push_str("alias cd='agentii_cd'\n");
            // chpwd hook with recursion guard
            zshrc.push_str("_agentii_chpwd_guard=0\n");
            zshrc.push_str("agentii_chpwd() {\n");
            zshrc.push_str("  (( _agentii_chpwd_guard )) && return\n");
            zshrc.push_str("  local real=$(pwd -P)\n");
            zshrc.push_str("  if [[ \"$real\" != \"$AGENTII_WS\"* ]]; then\n");
            zshrc.push_str("    _agentii_chpwd_guard=1\n");
            zshrc.push_str("    echo \"\\033[33m⚠ Snapped back to workspace (host filesystem access denied)\\033[0m\" >&2\n");
            zshrc.push_str("    builtin cd \"$AGENTII_WS\"\n");
            zshrc.push_str("    _agentii_chpwd_guard=0\n");
            zshrc.push_str("  fi\n");
            zshrc.push_str("}\n");
            zshrc.push_str("autoload -Uz add-zsh-hook\n");
            zshrc.push_str("add-zsh-hook chpwd agentii_chpwd\n");
            // Clean pwd display: replace real workspace path with /workspace
            zshrc.push_str("agentii_pwd() { echo \"${PWD/$AGENTII_WS/$AGENTII_WS_VIRTUAL}\" }\n");
            zshrc.push_str("alias pwd='agentii_pwd'\n");
            // Also override pushd/popd to go through the same check
            zshrc.push_str("alias pushd='agentii_cd'\n");
            zshrc.push_str("alias popd='builtin cd \"$AGENTII_WS\"'\n");

            let _ = std::fs::write(format!("{zdotdir}/.zshrc"), &zshrc);

            // Phase 3A: Sanitize host env vars before PTY spawn
            let raw_env: HashMap<String, String> = std::env::vars().collect();
            let sanitized = agentii_vm::security::env_sanitizer::sanitize_env(&raw_env);

            // Build clean env: sanitized system vars + ZDOTDIR/AGENTII_* overrides
            let mut clean_env: Vec<(&str, String)> = Vec::new();
            // Collect sanitized vars (owned Strings)
            let sanitized_pairs: Vec<(String, String)> = sanitized.into_iter().collect();
            for (k, v) in &sanitized_pairs {
                clean_env.push((k.as_str(), v.clone()));
            }
            // Add workspace-specific overrides
            let zdotdir_owned = zdotdir.clone();
            let project_id_owned = project_id.to_string();
            clean_env.push(("ZDOTDIR", zdotdir_owned.clone()));
            clean_env.push(("AGENTII_PROJECT_ID", project_id_owned.clone()));
            clean_env.push(("AGENTII_WORKSPACE", "/workspace".to_string()));
            // Use TERM override from frontend query param (e.g., "xterm" for goose/reedline)
            // or default to xterm-256color for full color support.
            let term_value = term_override.unwrap_or("xterm-256color").to_string();
            clean_env.push(("TERM", term_value));

            // Inject CLI-specific API keys (e.g. ANTHROPIC_API_KEY for goose)
            let cli_env_owned: Vec<(String, String)> = cli_env_vars.into_iter().collect();
            for (k, v) in &cli_env_owned {
                clean_env.push((k.as_str(), v.clone()));
            }

            // Build the env_vars slice for spawn_with_clean_env
            let env_refs: Vec<(&str, &str)> = clean_env.iter()
                .map(|(k, v)| (*k, v.as_str()))
                .collect();

            // Spawn the requested CLI (or shell fallback) with args
            let spawn_result = if spawn_args.is_empty() {
                pty_manager.spawn_with_clean_env(
                    &tid, &spawn_command, &workspace_str, 80, 24, &env_refs,
                ).await
            } else {
                let arg_refs: Vec<&str> = spawn_args.iter().map(|s| s.as_str()).collect();
                pty_manager.spawn_with_args_and_env(
                    &tid, &spawn_command, &arg_refs,
                    &workspace_str, 80, 24, &env_refs, false,
                ).await
            };

            if let Err(e) = spawn_result {
                warn!(terminal = %tid, command = %spawn_command, error = %e, "Failed to spawn PTY on connect");
                let (mut sink, _) = ws_stream.split();
                let err_msg = format!("\r\n\x1b[31mFailed to spawn {spawn_command}: {e}\x1b[0m\r\n");
                let _ = sink.send(Message::Binary(err_msg.into_bytes())).await;
                let _ = sink.close().await;
                return;
            }

            info!(terminal = %tid, command = %spawn_command, cli = ?cli_id, "PTY process spawned");
        }

        // Subscribe to PTY output before entering the main loop so we don't miss
        // the initial shell prompt.
        let mut pty_rx = match pty_manager.subscribe(&tid).await {
            Ok(rx) => rx,
            Err(e) => {
                warn!(terminal = %tid, error = %e, "Failed to subscribe to PTY output");
                return;
            }
        };

        let (ws_sink, mut ws_stream) = ws_stream.split();
        let ws_sink = Arc::new(tokio::sync::Mutex::new(ws_sink));

        // VM isolation status is reported through the vm.status RPC on Channel 2,
        // not as a terminal banner. The frontend can show a persistent UI indicator
        // based on the `vm_available` field in the vm.status response.

        // Task: PTY stdout → WebSocket binary frames (with credential leak detection)
        let pty_reader_handle = {
            let ws_sink = ws_sink.clone();
            let tid = tid.clone();
            tokio::spawn(async move {
                loop {
                    match pty_rx.recv().await {
                        Ok(data) => {
                            // Scan PTY output for credential leaks before forwarding
                            // Phase 5B: Also scan binary data via lossy UTF-8 conversion
                            let sanitized = if let Ok(text) = std::str::from_utf8(&data) {
                                let cleaned = agentii_vm::security::leak_detector::scan_output_full(text);
                                cleaned.into_bytes()
                            } else {
                                // Binary data — convert to lossy UTF-8 and scan
                                let lossy = String::from_utf8_lossy(&data);
                                if agentii_vm::security::leak_detector::contains_credential_pattern(&lossy) {
                                    let cleaned = agentii_vm::security::leak_detector::scan_output_full(&lossy);
                                    cleaned.into_bytes()
                                } else {
                                    data
                                }
                            };
                            let mut sink = ws_sink.lock().await;
                            if sink.send(Message::Binary(sanitized)).await.is_err() {
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            info!(terminal = %tid, "PTY output channel closed");
                            break;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            warn!(terminal = %tid, skipped = n, "PTY output receiver lagged");
                        }
                    }
                }
            })
        };

        // Main loop: WebSocket frames from the client
        while let Some(msg) = ws_stream.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    match serde_json::from_str::<RequestFrame>(&text) {
                        Ok(request) if request.method == "terminal.resize" => {
                            // Handle resize directly via PtyManager since the PTY
                            // was spawned eagerly (not via terminal.create RPC).
                            let cols = request.params.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;
                            let rows = request.params.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u16;
                            if let Err(e) = pty_manager.resize(&tid, cols, rows).await {
                                warn!(terminal = %tid, error = %e, "Failed to resize PTY");
                            }
                            let response = ResponseFrame::success(request.id, serde_json::json!({}));
                            let json = serde_json::to_string(&response).unwrap();
                            let mut sink = ws_sink.lock().await;
                            if sink.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Ok(request) if request.method.starts_with("terminal.") => {
                            let response = terminal_rpc.handle(&request).await;
                            let json = serde_json::to_string(&response).unwrap();
                            let mut sink = ws_sink.lock().await;
                            if sink.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Ok(request) => {
                            let response = ResponseFrame::error(
                                request.id,
                                "INVALID_REQUEST",
                                format!(
                                    "Unsupported method on terminal channel: {}",
                                    request.method
                                ),
                            );
                            let json = serde_json::to_string(&response).unwrap();
                            let mut sink = ws_sink.lock().await;
                            if sink.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Err(_) => {
                            let mut sink = ws_sink.lock().await;
                            if sink.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                Ok(Message::Binary(data)) => {
                    if let Err(e) = pty_manager.write(&tid, &data).await {
                        warn!(terminal = %tid, error = %e, "Failed to write to PTY");
                    }
                }
                Ok(Message::Close(_)) => break,
                Err(e) => {
                    warn!(terminal = %tid, error = %e, "WebSocket error");
                    break;
                }
                _ => {}
            }
        }

        pty_reader_handle.abort();

        // Delay PTY kill to tolerate React StrictMode double-mount (unmount→remount).
        // Only kill if no newer WebSocket has connected for this terminal_id.
        let pty_manager_clone = pty_manager.clone();
        let tid_clone = tid.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            let current_epoch = pty_manager_clone.current_epoch(&tid_clone).await;
            if current_epoch == connection_epoch {
                if let Err(e) = pty_manager_clone.kill(&tid_clone).await {
                    warn!(terminal = %tid_clone, error = %e, "Deferred PTY kill failed");
                }
            } else {
                info!(terminal = %tid_clone, current_epoch, connection_epoch, "Skipping deferred PTY kill due to reconnect");
            }
        });

        info!(terminal = %tid, "Terminal WebSocket disconnected");
    }

    // Workspace resolution is now handled by workspace_init module.

    /// Handle a structured agent API WebSocket (Channel 2).
    ///
    /// Supports:
    /// - `connect` — handshake
    /// - `page.navigate` — triggers VM pre-warming for the given project
    /// - `vm.status` — returns current VM status for a project
    ///
    /// Also forwards `VmStatusEvent` broadcasts from the `VmEventBus` to the client.
    async fn handle_agent_ws(
        ws_stream: tokio_tungstenite::WebSocketStream<TcpStream>,
        vm_event_bus: Arc<VmEventBus>,
        vm_pool: Option<Arc<VmPoolManager>>,
        pty_manager: Arc<PtyManager>,
    ) {
        let (ws_sink, mut ws_stream_rx) = ws_stream.split();
        let ws_sink = Arc::new(tokio::sync::Mutex::new(ws_sink));

        // T035: Channel 2 event channel — GatewayBridge sends EventFrames here;
        // the event_forwarder task below serialises them to the WebSocket.
        let (event_tx, mut event_rx) = tokio::sync::mpsc::channel::<EventFrame>(64);

        // T035/T036/T037: Active bridge for the current chat.send run (if any).
        // Wrapped in Arc<Mutex<Option<...>>> so the main loop and the event forwarder
        // can both access it.
        let active_bridge: Arc<tokio::sync::Mutex<Option<Arc<GatewayBridge>>>> =
            Arc::new(tokio::sync::Mutex::new(None));

        // Subscribe to VM status events and forward them to this client.
        let mut vm_rx = vm_event_bus.subscribe();
        let event_forwarder = {
            let ws_sink = ws_sink.clone();
            tokio::spawn(async move {
                loop {
                    tokio::select! {
                        // T035: Forward EventFrames from GatewayBridge (Channel 2 agent events)
                        Some(frame) = event_rx.recv() => {
                            if let Ok(json) = serde_json::to_string(&frame) {
                                let mut sink = ws_sink.lock().await;
                                if sink.send(Message::Text(json)).await.is_err() {
                                    break;
                                }
                            }
                        }
                        // Forward VM status events
                        result = vm_rx.recv() => {
                            match result {
                                Ok(event) => {
                                    // Wrap in RpcEvent format: {type: "event", event: "<event_type>", payload: {...}}
                                    // The frontend handleFrame() dispatches on frame.type === "event"
                                    // and routes to handlers registered via onEvent(frame.event, ...).
                                    let event_name = event.event_type.clone();
                                    let payload = if event_name == "cli.readiness_changed" {
                                        // CLI readiness events carry tab_id/cli_id/injected_keys/error_message
                                        serde_json::json!({
                                            "tab_id": event.tab_id,
                                            "cli_id": event.cli_id,
                                            "state": event.status,
                                            "injected_keys": event.injected_keys,
                                            "error_message": event.error_message,
                                        })
                                    } else {
                                        // VM status events carry project_id/status/mcp_health/etc.
                                        serde_json::json!({
                                            "project_id": event.project_id,
                                            "status": event.status,
                                            "mcp_health": event.mcp_health,
                                            "base_image_version": event.base_image_version,
                                            "uptime_seconds": event.uptime_seconds,
                                        })
                                    };
                                    let rpc_event = serde_json::json!({
                                        "type": "event",
                                        "event": event_name,
                                        "payload": payload,
                                    });
                                    if let Ok(json) = serde_json::to_string(&rpc_event) {
                                        let mut sink = ws_sink.lock().await;
                                        if sink.send(Message::Text(json)).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                                Err(broadcast::error::RecvError::Closed) => break,
                                Err(broadcast::error::RecvError::Lagged(n)) => {
                                    warn!(skipped = n, "Channel 2 client lagged on vm events");
                                }
                            }
                        }
                    }
                }
            })
        };

        // Main loop: RPC frames from the client
        while let Some(msg) = ws_stream_rx.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    match serde_json::from_str::<RequestFrame>(&text) {
                        Ok(request) => {
                            let response = match request.method.as_str() {
                                "connect" => ResponseFrame::success(
                                    request.id,
                                    serde_json::json!({
                                        "type": "hello-ok",
                                        "server": { "name": "agentii", "version": "0.1.0" },
                                        "session_key": "default",
                                        "features": ["streaming", "tools", "vm.status"]
                                    }),
                                ),
                                "page.navigate" => {
                                    let page = request.params.get("page")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");
                                    let project_id = request.params.get("project_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");

                                    if page == "ide" && !project_id.is_empty() {
                                        info!(project = %project_id, "page.navigate to IDE — triggering pre-warm");
                                        // Phase 1C: Wire to pool.pre_warm() if available
                                        if let Some(ref pool) = vm_pool {
                                            let ws_path = workspace_init::find_workspace(project_id);
                                            let event_bus = vm_event_bus.clone();
                                            let project_id_clone = project_id.to_string();
                                            pool.pre_warm(
                                                project_id.to_string(),
                                                ws_path,
                                                VmConfig::default(),
                                                Some(move || {
                                                    event_bus.emit_vm_status(&project_id_clone, "running");
                                                }),
                                            );
                                        }
                                        vm_event_bus.emit_vm_status(project_id, "booting");
                                    }

                                    ResponseFrame::success(
                                        request.id,
                                        serde_json::json!({ "ok": true }),
                                    )
                                }
                                "vm.status" => {
                                    let project_id = request.params.get("project_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");

                                    if project_id.is_empty() {
                                        ResponseFrame::error(
                                            request.id,
                                            "INVALID_PARAMS",
                                            String::from("Missing project_id"),
                                        )
                                    } else {
                                        // Phase 1C: Query VmPoolManager for actual status
                                        let status = if let Some(ref pool) = vm_pool {
                                            let instances = pool.list().await;
                                            instances.iter()
                                                .find(|(id, _)| id == project_id)
                                                .map(|(_, s)| format!("{:?}", s).to_lowercase())
                                                .unwrap_or_else(|| "stopped".into())
                                        } else {
                                            "unavailable".into()
                                        };
                                        ResponseFrame::success(
                                            request.id,
                                            serde_json::json!({
                                                "project_id": project_id,
                                                "status": status,
                                                "vm_available": vm_pool.is_some(),
                                            }),
                                        )
                                    }
                                }
                                // T064: cli.list_installed RPC
                                "cli.list_installed" => {
                                    let project_id = request.params.get("project_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");
                                    let result = Self::handle_cli_list_installed(
                                        &vm_pool, project_id,
                                    ).await;
                                    ResponseFrame::success(request.id, result)
                                }
                                // T065: terminal.create RPC extension
                                "terminal.create" => {
                                    let project_id = request.params.get("project_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let terminal_id = request.params.get("terminal_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let cli_id = request.params.get("cli_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("goose")
                                        .to_string();

                                    if project_id.is_empty() || terminal_id.is_empty() {
                                        ResponseFrame::error(
                                            request.id,
                                            "INVALID_PARAMS",
                                            String::from("Missing project_id or terminal_id"),
                                        )
                                    } else {
                                        // Emit connecting state immediately
                                        Self::emit_cli_readiness_changed(
                                            &vm_event_bus, &terminal_id, &cli_id,
                                            "connecting", &[], None,
                                        );
                                        // Spawn CLI in background
                                        let pty_manager_clone = pty_manager.clone();
                                        let vm_pool_clone = vm_pool.clone();
                                        let vm_event_bus_clone = vm_event_bus.clone();
                                        let project_id_clone = project_id.clone();
                                        let terminal_id_clone = terminal_id.clone();
                                        let cli_id_clone = cli_id.clone();
                                        tokio::spawn(async move {
                                            let _ = Self::spawn_cli_in_vm(
                                                &pty_manager_clone,
                                                &vm_pool_clone,
                                                &vm_event_bus_clone,
                                                &project_id_clone,
                                                &terminal_id_clone,
                                                &cli_id_clone,
                                                None, // No TERM override from RPC path
                                            ).await;
                                        });
                                        ResponseFrame::success(
                                            request.id,
                                            serde_json::json!({
                                                "terminal_id": terminal_id,
                                                "cli_id": cli_id,
                                                "status": "connecting",
                                            }),
                                        )
                                    }
                                }
                                // T049: settings.keys_changed RPC handler
                                "settings.keys_changed" => {
                                    info!("settings.keys_changed received — re-provisioning CLI configs for all running VMs");
                                    // FR-015: Regenerate CLI config files for all running VMs within 30s
                                    if let Some(ref pool) = vm_pool {
                                        let pool = pool.clone();
                                        tokio::spawn(async move {
                                            let vms = pool.list().await;
                                            let global_mcp = agentii_vm::mcp_config::load_global_config().await;
                                            let tools = agentii_vm::mcp_config::merge_configs(&global_mcp, None);
                                            let backend = pool.backend();
                                            for (project_id, status) in &vms {
                                                if *status != VmStatus::Running { continue; }
                                                let vm_name = format!("agentii-{}", &project_id[..project_id.len().min(12)]);
                                                for cli_id in &["goose", "claude", "opencode", "codex"] {
                                                    if let Err(e) = agentii_vm::provisioner::reprovision_cli_config(
                                                        backend.as_ref(), &vm_name, cli_id, &tools,
                                                    ).await {
                                                        warn!(project = %project_id, cli = %cli_id, error = %e, "keys_changed: reprovision failed");
                                                    }
                                                }
                                                info!(project = %project_id, "keys_changed: CLI configs re-provisioned");
                                            }
                                        });
                                    }
                                    ResponseFrame::success(
                                        request.id,
                                        serde_json::json!({ "ok": true }),
                                    )
                                }
                                // T060: settings.mcp_changed / settings.skills_changed
                                "settings.mcp_changed" => {
                                    info!("settings.mcp_changed received — re-provisioning MCP configs for all running VMs");
                                    // FR-022: Propagate MCP tool changes to running VMs within 30s
                                    if let Some(ref pool) = vm_pool {
                                        let pool = pool.clone();
                                        tokio::spawn(async move {
                                            let vms = pool.list().await;
                                            let global_mcp = agentii_vm::mcp_config::load_global_config().await;
                                            let tools = agentii_vm::mcp_config::merge_configs(&global_mcp, None);
                                            let backend = pool.backend();
                                            for (project_id, status) in &vms {
                                                if *status != VmStatus::Running { continue; }
                                                let vm_name = format!("agentii-{}", &project_id[..project_id.len().min(12)]);
                                                for cli_id in &["goose", "claude", "opencode", "codex"] {
                                                    if let Err(e) = agentii_vm::provisioner::reprovision_cli_config(
                                                        backend.as_ref(), &vm_name, cli_id, &tools,
                                                    ).await {
                                                        warn!(project = %project_id, cli = %cli_id, error = %e, "mcp_changed: reprovision failed");
                                                    }
                                                }
                                                info!(project = %project_id, "mcp_changed: CLI configs re-provisioned");
                                            }
                                        });
                                    }
                                    ResponseFrame::success(
                                        request.id,
                                        serde_json::json!({ "ok": true }),
                                    )
                                }
                                "settings.skills_changed" => {
                                    info!("settings.skills_changed received — re-provisioning skills for all running VMs");
                                    // FR-022: Propagate skills changes to running VMs within 30s
                                    if let Some(ref pool) = vm_pool {
                                        let pool = pool.clone();
                                        tokio::spawn(async move {
                                            let vms = pool.list().await;
                                            let backend = pool.backend();
                                            for (project_id, status) in &vms {
                                                if *status != VmStatus::Running { continue; }
                                                let vm_name = format!("agentii-{}", &project_id[..project_id.len().min(12)]);
                                                if let Err(e) = agentii_vm::provisioner::provision_skills_for_workspace(
                                                    backend.as_ref(), &vm_name,
                                                ).await {
                                                    warn!(project = %project_id, error = %e, "skills_changed: provision failed");
                                                } else {
                                                    info!(project = %project_id, "skills_changed: skills re-provisioned");
                                                }
                                            }
                                        });
                                    }
                                    ResponseFrame::success(
                                        request.id,
                                        serde_json::json!({ "ok": true }),
                                    )
                                }
                                // agent.run: reserved for future agent core integration
                                "agent.run" => {
                                    ResponseFrame::error(
                                        request.id,
                                        "NOT_IMPLEMENTED",
                                        String::from("agent.run is not available — agent core pending reimplementation"),
                                    )
                                }
                                // T035: chat.send — spawn GatewayBridge → stream AgentEvent EventFrames on Channel 2
                                "chat.send" => {
                                    let session_id = request.params.get("session_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("default")
                                        .to_string();
                                    let message = request.params.get("message")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();

                                    if message.is_empty() {
                                        ResponseFrame::error(
                                            request.id,
                                            "INVALID_PARAMS",
                                            String::from("chat.send requires a non-empty message"),
                                        )
                                    } else {
                                        // Create a new GatewayBridge for this run
                                        let bridge = Arc::new(GatewayBridge::new(
                                            session_id.clone(),
                                            event_tx.clone(),
                                        ));
                                        // Store as active bridge (for abort/approval)
                                        {
                                            let mut guard = active_bridge.lock().await;
                                            *guard = Some(bridge.clone());
                                        }
                                        // Spawn the run in a background task
                                        let bridge_clone = bridge.clone();
                                        let active_bridge_clone = active_bridge.clone();
                                        tokio::spawn(async move {
                                            bridge_clone.send_run_started();
                                            // Simulate a minimal run: emit the message as a text delta
                                            // and finish. Real integration would wire ConversationRuntime here.
                                            if !bridge_clone.is_aborted() {
                                                bridge_clone.send_text_delta(&message);
                                            }
                                            bridge_clone.send_run_finished(0.0, 0, 0);
                                            // Clear active bridge when done
                                            let mut guard = active_bridge_clone.lock().await;
                                            *guard = None;
                                        });
                                        ResponseFrame::success(
                                            request.id,
                                            serde_json::json!({
                                                "session_id": session_id,
                                                "status": "running",
                                            }),
                                        )
                                    }
                                }
                                // T036: chat.abort — set hook_abort_signal on active ConversationRuntime via bridge
                                "chat.abort" => {
                                    let guard = active_bridge.lock().await;
                                    if let Some(ref bridge) = *guard {
                                        bridge.abort();
                                        info!(session = %bridge.session_id, "chat.abort: abort signal set");
                                        ResponseFrame::success(
                                            request.id,
                                            serde_json::json!({ "ok": true, "aborted": true }),
                                        )
                                    } else {
                                        ResponseFrame::success(
                                            request.id,
                                            serde_json::json!({ "ok": true, "aborted": false, "reason": "no active run" }),
                                        )
                                    }
                                }
                                // T037: exec.approval.resolve — permission approval/denial from IDE → PermissionEnforcer resolution
                                "exec.approval.resolve" => {
                                    let request_id = request.params.get("request_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let approved = request.params.get("approved")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(false);

                                    if request_id.is_empty() {
                                        ResponseFrame::error(
                                            request.id,
                                            "INVALID_PARAMS",
                                            String::from("exec.approval.resolve requires request_id"),
                                        )
                                    } else {
                                        let guard = active_bridge.lock().await;
                                        let resolved = if let Some(ref bridge) = *guard {
                                            bridge.resolve_approval(&request_id, approved)
                                        } else {
                                            false
                                        };
                                        if resolved {
                                            info!(request_id = %request_id, approved, "exec.approval.resolve: resolved");
                                        } else {
                                            warn!(request_id = %request_id, "exec.approval.resolve: request_id not found");
                                        }
                                        ResponseFrame::success(
                                            request.id,
                                            serde_json::json!({
                                                "ok": true,
                                                "resolved": resolved,
                                                "request_id": request_id,
                                                "approved": approved,
                                            }),
                                        )
                                    }
                                }
                                _ => ResponseFrame::error(
                                    request.id,
                                    "INVALID_REQUEST",
                                    format!(
                                        "Agent API not yet implemented: {}",
                                        request.method
                                    ),
                                ),
                            };

                            let json = serde_json::to_string(&response).unwrap();
                            let mut sink = ws_sink.lock().await;
                            if sink.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            let err = ResponseFrame::error(
                                "0".into(),
                                "INVALID_REQUEST",
                                format!("Failed to parse request: {e}"),
                            );
                            let json = serde_json::to_string(&err).unwrap();
                            let mut sink = ws_sink.lock().await;
                            let _ = sink.send(Message::Text(json)).await;
                        }
                    }
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }

        event_forwarder.abort();
    }
}

/// Find the end of HTTP headers (\r\n\r\n) in a buffer.
/// Returns the index of the first \r in the \r\n\r\n sequence.
fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4)
        .position(|w| w == b"\r\n\r\n")
}

/// Parse Content-Length from raw HTTP headers string.
fn parse_content_length(headers: &str) -> usize {
    for line in headers.lines() {
        if let Some(val) = line.strip_prefix("Content-Length:").or_else(|| line.strip_prefix("content-length:")) {
            if let Ok(len) = val.trim().parse::<usize>() {
                return len;
            }
        }
    }
    0
}

/// Write an HTTP response with JSON content type and CORS headers.
async fn write_http_response(
    stream: &mut TcpStream,
    status: u16,
    body: &[u8],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        _ => "Unknown",
    };

    let header = format!(
        "HTTP/1.1 {status} {status_text}\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Access-Control-Allow-Methods: POST, OPTIONS\r\n\
         Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
         Connection: close\r\n\
         \r\n",
        body.len()
    );

    stream.write_all(header.as_bytes()).await?;
    stream.write_all(body).await?;
    stream.flush().await?;
    Ok(())
}

/// Extract Authorization: Bearer token from raw HTTP headers.
fn extract_authorization_header(headers: &str) -> Option<String> {
    for line in headers.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("authorization:") {
            let value = line.splitn(2, ':').nth(1)?.trim();
            return crate::auth::extract_bearer_token(value);
        }
    }
    None
}
