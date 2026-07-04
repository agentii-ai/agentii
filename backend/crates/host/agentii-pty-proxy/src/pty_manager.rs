use std::collections::HashMap;
use std::io::{Read as IoRead, Write as IoWrite};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tokio::sync::{broadcast, Mutex, RwLock};
use tracing::{info, warn};

/// A single PTY session: the child process + master PTY handle + output broadcast.
struct PtySession {
    child: Box<dyn Child + Send + Sync>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn IoWrite + Send>,
    _reader_task: tokio::task::JoinHandle<()>,
    output_tx: broadcast::Sender<Vec<u8>>,
}

/// Manages local PTY processes keyed by terminal_id.
///
/// Tracks a per-terminal connection counter so deferred kills can detect
/// whether a new WebSocket reconnected after the one that triggered the kill.
pub struct PtyManager {
    sessions: Arc<RwLock<HashMap<String, Arc<Mutex<PtySession>>>>>,
    /// Monotonically increasing connection epoch per terminal_id.
    conn_epochs: Arc<RwLock<HashMap<String, Arc<AtomicU64>>>>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            conn_epochs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Bump the connection epoch for a terminal and return the new value.
    /// Called when a new WebSocket connects for this terminal_id.
    pub async fn bump_epoch(&self, terminal_id: &str) -> u64 {
        let mut epochs = self.conn_epochs.write().await;
        let counter = epochs
            .entry(terminal_id.to_string())
            .or_insert_with(|| Arc::new(AtomicU64::new(0)));
        counter.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// Get the current connection epoch for a terminal.
    pub async fn current_epoch(&self, terminal_id: &str) -> u64 {
        let epochs = self.conn_epochs.read().await;
        epochs
            .get(terminal_id)
            .map(|c| c.load(Ordering::SeqCst))
            .unwrap_or(0)
    }

    /// Check if a PTY session already exists for a terminal.
    pub async fn has_session(&self, terminal_id: &str) -> bool {
        self.sessions.read().await.contains_key(terminal_id)
    }

    /// Spawn a new PTY process. If one already exists for this terminal_id,
    /// reuse it (returns Ok without spawning a new one).
    ///
    /// `extra_env` allows callers to inject environment variables (e.g., custom
    /// PS1 prompt, HOME override) into the spawned shell process.
    pub async fn spawn(
        &self,
        terminal_id: &str,
        cli: &str,
        cwd: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        self.spawn_with_env(terminal_id, cli, cwd, cols, rows, &[]).await
    }

    /// Spawn a new PTY process with additional environment variables.
    pub async fn spawn_with_env(
        &self,
        terminal_id: &str,
        cli: &str,
        cwd: &str,
        cols: u16,
        rows: u16,
        extra_env: &[(&str, &str)],
    ) -> Result<(), String> {
        self.spawn_with_args_and_env(terminal_id, cli, &[], cwd, cols, rows, extra_env, false).await
    }

    /// Spawn a new PTY process with explicit command arguments and environment variables.
    ///
    /// When `clean_env` is true, calls `env_clear()` before setting env vars (no host
    /// env leaks through). When false, inherits the host environment and adds `extra_env`.
    pub async fn spawn_with_args_and_env(
        &self,
        terminal_id: &str,
        cli: &str,
        args: &[&str],
        cwd: &str,
        cols: u16,
        rows: u16,
        extra_env: &[(&str, &str)],
        clean_env: bool,
    ) -> Result<(), String> {
        // Reuse existing session (handles React StrictMode double-mount)
        if self.has_session(terminal_id).await {
            info!(terminal = %terminal_id, "PTY session already exists, reusing");
            return Ok(());
        }

        let pty_system = native_pty_system();

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        let mut cmd = CommandBuilder::new(cli);
        for arg in args {
            cmd.arg(arg);
        }
        // Set cwd only if the directory exists
        let cwd_path = std::path::Path::new(cwd);
        if cwd_path.exists() {
            cmd.cwd(cwd_path);
        }
        if clean_env {
            cmd.env_clear();
        } else {
            // Set TERM so the shell knows it's in a terminal
            cmd.env("TERM", "xterm-256color");
        }
        // Inject caller-provided env vars
        for (key, val) in extra_env {
            cmd.env(key, val);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command '{cli}': {e}"))?;

        // Drop the slave side — we only need the master
        drop(pair.slave);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

        // Broadcast channel for PTY output (8KB buffer should be plenty)
        let (output_tx, _) = broadcast::channel::<Vec<u8>>(256);
        let tx = output_tx.clone();

        // Spawn a blocking reader task that reads from the PTY and broadcasts output
        let tid = terminal_id.to_string();
        let reader_task = tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        info!(terminal = %tid, "PTY reader: EOF");
                        break;
                    }
                    Ok(n) => {
                        // If no receivers, that's fine — data is just dropped
                        let _ = tx.send(buf[..n].to_vec());
                    }
                    Err(e) => {
                        // On macOS, EIO means the child exited
                        if e.raw_os_error() == Some(5) {
                            info!(terminal = %tid, "PTY reader: child exited (EIO)");
                        } else {
                            warn!(terminal = %tid, error = %e, "PTY reader error");
                        }
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            child,
            master: pair.master,
            writer,
            _reader_task: reader_task,
            output_tx,
        };

        self.sessions
            .write()
            .await
            .insert(terminal_id.to_string(), Arc::new(Mutex::new(session)));

        info!(terminal = %terminal_id, cli = %cli, cwd = %cwd, "PTY process spawned");
        Ok(())
    }

    /// Spawn a new PTY process with a clean environment (env_clear pattern).
    /// Only the explicitly provided env vars are set — no host env leaks through.
    /// Used for the host PTY fallback when VM isolation is unavailable.
    pub async fn spawn_with_clean_env(
        &self,
        terminal_id: &str,
        cli: &str,
        cwd: &str,
        cols: u16,
        rows: u16,
        env_vars: &[(&str, &str)],
    ) -> Result<(), String> {
        self.spawn_with_args_and_env(terminal_id, cli, &[], cwd, cols, rows, env_vars, true).await
    }

    /// Write data to a PTY's stdin.
    pub async fn write(&self, terminal_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {terminal_id} not found"))?
            .clone();

        let mut session = session.lock().await;
        session
            .writer
            .write_all(data)
            .map_err(|e| format!("PTY write error: {e}"))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("PTY flush error: {e}"))?;
        Ok(())
    }

    /// Resize a PTY.
    pub async fn resize(&self, terminal_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {terminal_id} not found"))?
            .clone();

        let session = session.lock().await;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("PTY resize error: {e}"))?;
        Ok(())
    }

    /// Kill a PTY process and remove the session.
    pub async fn kill(&self, terminal_id: &str) -> Result<(), String> {
        let session = self.sessions.write().await.remove(terminal_id);
        if let Some(session) = session {
            let mut session = session.lock().await;
            if let Err(e) = session.child.kill() {
                warn!(terminal = %terminal_id, error = %e, "Failed to kill PTY child");
            }
            let _ = session.child.wait();
            info!(terminal = %terminal_id, "PTY process killed");
        }
        Ok(())
    }

    /// Subscribe to PTY output for a terminal.
    pub async fn subscribe(
        &self,
        terminal_id: &str,
    ) -> Result<broadcast::Receiver<Vec<u8>>, String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {terminal_id} not found"))?
            .clone();

        let session = session.lock().await;
        Ok(session.output_tx.subscribe())
    }

    /// Get the PID of a PTY child process.
    pub async fn get_pid(&self, terminal_id: &str) -> Option<u32> {
        let sessions = self.sessions.read().await;
        let session = sessions.get(terminal_id)?.clone();
        let session = session.lock().await;
        session.child.process_id()
    }
}
