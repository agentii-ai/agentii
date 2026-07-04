use std::sync::Arc;

use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;
use tracing::{debug, info, warn};

/// A single PTY relay session connecting a WebSocket client to a PTY broker session.
pub struct PtyRelay {
    pub terminal_id: String,
    pub vm_name: String,
}

impl PtyRelay {
    pub fn new(terminal_id: String, vm_name: String) -> Self {
        Self {
            terminal_id,
            vm_name,
        }
    }

    /// Run the bidirectional relay between WebSocket and VM PTY broker.
    ///
    /// - Client → Server (keystrokes): WebSocket binary frames → PTY broker write
    /// - Server → Client (PTY output): PTY broker data → WebSocket binary frames
    pub async fn run(
        &self,
        ws_stream: WebSocketStream<TcpStream>,
        broker_reader: tokio::io::BufReader<tokio::net::unix::OwnedReadHalf>,
        broker_writer: Arc<Mutex<tokio::net::unix::OwnedWriteHalf>>,
    ) {
        let (ws_sink, ws_stream) = ws_stream.split();
        let ws_sink = Arc::new(Mutex::new(ws_sink));

        let terminal_id = self.terminal_id.clone();

        // Task 1: WebSocket → PTY broker (keystrokes)
        let ws_to_pty = {
            let broker_writer = broker_writer.clone();
            let terminal_id = terminal_id.clone();
            tokio::spawn(async move {
                Self::forward_ws_to_pty(ws_stream, broker_writer, &terminal_id).await;
            })
        };

        // Task 2: PTY broker → WebSocket (output)
        let pty_to_ws = {
            let ws_sink = ws_sink.clone();
            let terminal_id = terminal_id.clone();
            tokio::spawn(async move {
                Self::forward_pty_to_ws(broker_reader, ws_sink, &terminal_id).await;
            })
        };

        // Wait for either direction to finish
        tokio::select! {
            _ = ws_to_pty => {
                info!(terminal = %terminal_id, "WebSocket→PTY relay ended");
            }
            _ = pty_to_ws => {
                info!(terminal = %terminal_id, "PTY→WebSocket relay ended");
            }
        }
    }

    async fn forward_ws_to_pty(
        mut ws_stream: SplitStream<WebSocketStream<TcpStream>>,
        broker_writer: Arc<Mutex<tokio::net::unix::OwnedWriteHalf>>,
        terminal_id: &str,
    ) {
        use tokio::io::AsyncWriteExt;

        while let Some(msg) = ws_stream.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    // Forward raw bytes to PTY broker
                    let header = serde_json::json!({
                        "type": "write",
                        "session_id": terminal_id,
                    });
                    let header_bytes = serde_json::to_vec(&header).unwrap();
                    let frame_len = header_bytes.len() + 1 + data.len(); // header + \n + payload

                    let mut writer = broker_writer.lock().await;
                    let len_bytes = (frame_len as u32).to_be_bytes();
                    if writer.write_all(&len_bytes).await.is_err() {
                        break;
                    }
                    if writer.write_all(&header_bytes).await.is_err() {
                        break;
                    }
                    if writer.write_all(b"\n").await.is_err() {
                        break;
                    }
                    if writer.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Ok(Message::Text(text)) => {
                    // Text messages treated as keystrokes too
                    let header = serde_json::json!({
                        "type": "write",
                        "session_id": terminal_id,
                    });
                    let header_bytes = serde_json::to_vec(&header).unwrap();
                    let data = text.as_bytes();
                    let frame_len = header_bytes.len() + 1 + data.len();

                    let mut writer = broker_writer.lock().await;
                    let len_bytes = (frame_len as u32).to_be_bytes();
                    let _ = writer.write_all(&len_bytes).await;
                    let _ = writer.write_all(&header_bytes).await;
                    let _ = writer.write_all(b"\n").await;
                    let _ = writer.write_all(data).await;
                }
                Ok(Message::Close(_)) => {
                    debug!(terminal = %terminal_id, "WebSocket closed by client");
                    break;
                }
                Ok(Message::Ping(_data)) => {
                    // Handled by tungstenite automatically
                }
                Err(e) => {
                    warn!(terminal = %terminal_id, error = %e, "WebSocket read error");
                    break;
                }
                _ => {}
            }
        }
    }

    async fn forward_pty_to_ws(
        mut broker_reader: tokio::io::BufReader<tokio::net::unix::OwnedReadHalf>,
        ws_sink: Arc<Mutex<SplitSink<WebSocketStream<TcpStream>, Message>>>,
        terminal_id: &str,
    ) {
        use tokio::io::AsyncReadExt;

        let mut len_buf = [0u8; 4];
        loop {
            // Read frame length
            if broker_reader.read_exact(&mut len_buf).await.is_err() {
                break;
            }
            let frame_len = u32::from_be_bytes(len_buf) as usize;

            // Read frame data
            let mut frame_data = vec![0u8; frame_len];
            if broker_reader.read_exact(&mut frame_data).await.is_err() {
                break;
            }

            // Parse header to check if it's data for our terminal
            if let Some(newline_pos) = frame_data.iter().position(|&b| b == b'\n') {
                let header = &frame_data[..newline_pos];
                let payload = &frame_data[newline_pos + 1..];

                if let Ok(msg) = serde_json::from_slice::<serde_json::Value>(header) {
                    if msg.get("type").and_then(|t| t.as_str()) == Some("data")
                        && msg.get("session_id").and_then(|s| s.as_str()) == Some(terminal_id)
                    {
                        let mut sink = ws_sink.lock().await;
                        if sink.send(Message::Binary(payload.to_vec().into())).await.is_err() {
                            break;
                        }
                    }
                }
            }
        }
    }
}
