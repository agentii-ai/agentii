use serde::{Deserialize, Serialize};

/// Request to create a new terminal session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCreateRequest {
    /// CLI to launch (e.g. "goose", "opencode", "bash"). Defaults to default shell.
    #[serde(default)]
    pub cli: Option<String>,
    /// Working directory inside the VM. Defaults to /workspace.
    #[serde(default)]
    pub cwd: Option<String>,
    /// Additional environment variables.
    #[serde(default)]
    pub env: Option<std::collections::HashMap<String, String>>,
    /// Terminal columns. Defaults to 80.
    #[serde(default = "default_cols")]
    pub cols: u16,
    /// Terminal rows. Defaults to 24.
    #[serde(default = "default_rows")]
    pub rows: u16,
}

fn default_cols() -> u16 {
    80
}
fn default_rows() -> u16 {
    24
}

/// Response after creating a terminal session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCreateResponse {
    pub terminal_id: String,
}

/// Request to write data to a terminal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalWriteRequest {
    pub terminal_id: String,
    /// Base64-encoded or raw string data to write to PTY stdin.
    pub data: String,
}

/// Request to resize a terminal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalResizeRequest {
    pub terminal_id: String,
    pub cols: u16,
    pub rows: u16,
}

/// Request to close a terminal session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCloseRequest {
    pub terminal_id: String,
}

/// Request to list active terminals.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalListRequest {}

/// Information about a single terminal session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub terminal_id: String,
    pub cli: String,
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
    pub pid: Option<u32>,
}

/// Response listing active terminals.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalListResponse {
    pub terminals: Vec<TerminalInfo>,
}

/// Options for spawning a PTY session inside the VM.
/// Extended with CLI-specific fields for key injection and config provisioning.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtySpawnOptions {
    /// Command to execute (e.g., "goose", "claude", "bash").
    pub command: String,
    /// Arguments to the command.
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory inside the VM.
    #[serde(default = "default_cwd")]
    pub cwd: String,
    /// Environment variables to inject (API keys + CLI-specific vars).
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
    /// Terminal rows.
    #[serde(default = "default_rows")]
    pub rows: u16,
    /// Terminal columns.
    #[serde(default = "default_cols")]
    pub cols: u16,
    /// CLI agent profile ID. Used to determine which config to re-provision.
    #[serde(default)]
    pub cli_id: String,
    /// Whether to re-provision CLI config before spawning (default: true).
    #[serde(default = "default_reprovision")]
    pub reprovision_config: bool,
}

fn default_cwd() -> String {
    "/workspace/".into()
}

fn default_reprovision() -> bool {
    true
}

impl Default for PtySpawnOptions {
    fn default() -> Self {
        Self {
            command: "bash".into(),
            args: Vec::new(),
            cwd: default_cwd(),
            env: std::collections::HashMap::new(),
            rows: default_rows(),
            cols: default_cols(),
            cli_id: String::new(),
            reprovision_config: true,
        }
    }
}

/// All terminal RPC methods.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", content = "params")]
pub enum TerminalRpc {
    #[serde(rename = "terminal.create")]
    Create(TerminalCreateRequest),
    #[serde(rename = "terminal.write")]
    Write(TerminalWriteRequest),
    #[serde(rename = "terminal.resize")]
    Resize(TerminalResizeRequest),
    #[serde(rename = "terminal.close")]
    Close(TerminalCloseRequest),
    #[serde(rename = "terminal.list")]
    List(TerminalListRequest),
}
