use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;
use tracing::{info, warn};

use agentii_protocol::gateway::{ResponseFrame, RequestFrame};
use agentii_protocol::terminal::*;

use crate::pty_manager::PtyManager;

/// Tracks active terminal sessions.
#[derive(Debug, Clone)]
pub struct TerminalSession {
    pub terminal_id: String,
    pub cli: String,
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
    pub vm_name: String,
}

/// Terminal RPC handler — dispatches terminal.* methods.
pub struct TerminalRpcHandler {
    default_vm_name: String,
    sessions: Arc<RwLock<HashMap<String, TerminalSession>>>,
    pty_manager: Arc<PtyManager>,
}

impl Default for TerminalRpcHandler {
    fn default() -> Self {
        Self::new(String::new(), Arc::new(PtyManager::new()))
    }
}

impl TerminalRpcHandler {
    pub fn new(default_vm_name: String, pty_manager: Arc<PtyManager>) -> Self {
        Self {
            default_vm_name,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            pty_manager,
        }
    }

    /// Handle a terminal RPC request and return a response frame.
    pub async fn handle(&self, request: &RequestFrame) -> ResponseFrame {
        match request.method.as_str() {
            "terminal.create" => self.handle_create(request).await,
            "terminal.close" => self.handle_close(request).await,
            "terminal.resize" => self.handle_resize(request).await,
            "terminal.list" => self.handle_list(request).await,
            _ => ResponseFrame::error(
                request.id.clone(),
                "INVALID_REQUEST",
                format!("Unknown terminal method: {}", request.method),
            ),
        }
    }

    async fn handle_create(&self, request: &RequestFrame) -> ResponseFrame {
        let params: TerminalCreateRequest = match serde_json::from_value(request.params.clone()) {
            Ok(p) => p,
            Err(e) => {
                return ResponseFrame::error(
                    request.id.clone(),
                    "INVALID_REQUEST",
                    format!("Invalid create params: {e}"),
                );
            }
        };

        let terminal_id = uuid::Uuid::new_v4().to_string();
        let cli = params.cli.unwrap_or_else(|| "bash".into());
        let cwd = params.cwd.unwrap_or_else(|| "/workspace".into());

        // Spawn the real PTY process
        if let Err(e) = self
            .pty_manager
            .spawn(&terminal_id, &cli, &cwd, params.cols, params.rows)
            .await
        {
            warn!(terminal = %terminal_id, error = %e, "Failed to spawn PTY");
            return ResponseFrame::error(
                request.id.clone(),
                "INTERNAL",
                format!("Failed to spawn PTY: {e}"),
            );
        }

        let session = TerminalSession {
            terminal_id: terminal_id.clone(),
            cli: cli.clone(),
            cwd: cwd.clone(),
            cols: params.cols,
            rows: params.rows,
            vm_name: self.default_vm_name.clone(),
        };

        self.sessions.write().await.insert(terminal_id.clone(), session);

        info!(terminal = %terminal_id, cli = %cli, "Terminal session created with PTY");

        ResponseFrame::success(
            request.id.clone(),
            serde_json::to_value(TerminalCreateResponse {
                terminal_id,
            })
            .unwrap(),
        )
    }

    async fn handle_close(&self, request: &RequestFrame) -> ResponseFrame {
        let params: TerminalCloseRequest = match serde_json::from_value(request.params.clone()) {
            Ok(p) => p,
            Err(e) => {
                return ResponseFrame::error(
                    request.id.clone(),
                    "INVALID_REQUEST",
                    format!("Invalid close params: {e}"),
                );
            }
        };

        // Kill the PTY process
        if let Err(e) = self.pty_manager.kill(&params.terminal_id).await {
            warn!(terminal = %params.terminal_id, error = %e, "Failed to kill PTY");
        }

        let removed = self.sessions.write().await.remove(&params.terminal_id);
        if removed.is_some() {
            info!(terminal = %params.terminal_id, "Terminal session closed");
            ResponseFrame::success(request.id.clone(), serde_json::json!({}))
        } else {
            ResponseFrame::error(
                request.id.clone(),
                "NOT_FOUND",
                format!("Terminal {} not found", params.terminal_id),
            )
        }
    }

    async fn handle_resize(&self, request: &RequestFrame) -> ResponseFrame {
        let params: TerminalResizeRequest = match serde_json::from_value(request.params.clone()) {
            Ok(p) => p,
            Err(e) => {
                return ResponseFrame::error(
                    request.id.clone(),
                    "INVALID_REQUEST",
                    format!("Invalid resize params: {e}"),
                );
            }
        };

        // Resize the PTY
        if let Err(e) = self
            .pty_manager
            .resize(&params.terminal_id, params.cols, params.rows)
            .await
        {
            warn!(terminal = %params.terminal_id, error = %e, "Failed to resize PTY");
        }

        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(&params.terminal_id) {
            session.cols = params.cols;
            session.rows = params.rows;
            ResponseFrame::success(request.id.clone(), serde_json::json!({}))
        } else {
            ResponseFrame::error(
                request.id.clone(),
                "NOT_FOUND",
                format!("Terminal {} not found", params.terminal_id),
            )
        }
    }

    async fn handle_list(&self, request: &RequestFrame) -> ResponseFrame {
        let sessions = self.sessions.read().await;
        let mut terminals: Vec<TerminalInfo> = Vec::with_capacity(sessions.len());

        for s in sessions.values() {
            let pid = self.pty_manager.get_pid(&s.terminal_id).await;
            terminals.push(TerminalInfo {
                terminal_id: s.terminal_id.clone(),
                cli: s.cli.clone(),
                cwd: s.cwd.clone(),
                cols: s.cols,
                rows: s.rows,
                pid,
            });
        }

        ResponseFrame::success(
            request.id.clone(),
            serde_json::to_value(TerminalListResponse { terminals }).unwrap(),
        )
    }

    /// Get session info for a terminal.
    pub async fn get_session(&self, terminal_id: &str) -> Option<TerminalSession> {
        self.sessions.read().await.get(terminal_id).cloned()
    }

    /// Get active session count.
    pub async fn session_count(&self) -> usize {
        self.sessions.read().await.len()
    }
}
