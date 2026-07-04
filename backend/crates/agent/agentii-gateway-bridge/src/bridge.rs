//! GatewayBridge: translates ConversationRuntime events to AgentEvent EventFrames.
use agentii_protocol::gateway::EventFrame;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc as tokio_mpsc, oneshot};

/// Abort signal that can be set from the gateway to cancel an in-progress run.
#[derive(Debug, Clone, Default)]
pub struct BridgeAbortSignal {
    aborted: Arc<AtomicBool>,
}

impl BridgeAbortSignal {
    pub fn new() -> Self {
        Self::default()
    }

    /// Signal abort — the running ConversationRuntime will stop after the current tool.
    pub fn abort(&self) {
        self.aborted.store(true, Ordering::SeqCst);
    }

    pub fn is_aborted(&self) -> bool {
        self.aborted.load(Ordering::SeqCst)
    }
}

/// Pending approval request waiting for IDE resolution.
struct PendingApproval {
    tx: oneshot::Sender<bool>,
}

/// Bridge between the synchronous ConversationRuntime and the async gateway WebSocket.
pub struct GatewayBridge {
    pub session_id: String,
    seq: AtomicU64,
    event_tx: tokio_mpsc::Sender<EventFrame>,
    /// Abort signal shared with the running ConversationRuntime.
    pub abort_signal: BridgeAbortSignal,
    /// Pending approval requests keyed by request_id.
    pending_approvals: Arc<Mutex<HashMap<String, PendingApproval>>>,
}

impl GatewayBridge {
    pub fn new(session_id: impl Into<String>, event_tx: tokio_mpsc::Sender<EventFrame>) -> Self {
        Self {
            session_id: session_id.into(),
            seq: AtomicU64::new(0),
            event_tx,
            abort_signal: BridgeAbortSignal::new(),
            pending_approvals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    // --- T036: Abort support ---

    /// Signal the active ConversationRuntime to abort after the current tool.
    pub fn abort(&self) {
        self.abort_signal.abort();
    }

    /// Returns true if an abort has been requested.
    pub fn is_aborted(&self) -> bool {
        self.abort_signal.is_aborted()
    }

    // --- T037: Approval resolution support ---

    /// Register a pending approval request. Returns a receiver that resolves to
    /// `true` (approved) or `false` (denied) when `resolve_approval` is called.
    pub fn register_approval(&self, request_id: impl Into<String>) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();
        let mut map = self.pending_approvals.lock().unwrap();
        map.insert(request_id.into(), PendingApproval { tx });
        rx
    }

    /// Resolve a pending approval request from the IDE.
    /// Returns `true` if the request_id was found and resolved, `false` if not found.
    pub fn resolve_approval(&self, request_id: &str, approved: bool) -> bool {
        let mut map = self.pending_approvals.lock().unwrap();
        if let Some(pending) = map.remove(request_id) {
            let _ = pending.tx.send(approved);
            true
        } else {
            false
        }
    }

    fn next_seq(&self) -> u64 {
        self.seq.fetch_add(1, Ordering::Relaxed)
    }

    fn send(&self, event: &str, payload: Value, stream: Option<bool>, done: Option<bool>) {
        let frame = EventFrame {
            frame_type: "event".to_string(),
            event: event.to_string(),
            payload,
            seq: self.next_seq(),
            stream: stream.map(|s| s.to_string()),
            done,
            channel: Some("2".to_string()),
        };
        let _ = self.event_tx.try_send(frame);
    }

    pub fn send_text_delta(&self, text: &str) {
        self.send("text_delta", json!({ "text": text }), Some(true), Some(false));
    }

    pub fn send_tool_call_start(&self, tool_name: &str, tool_id: &str, input: &Value) {
        self.send("tool_call_start", json!({
            "tool_name": tool_name, "tool_id": tool_id, "input": input
        }), Some(false), Some(false));
    }

    pub fn send_tool_call_end(&self, tool_id: &str, result: &Value, is_error: bool, duration_ms: u64) {
        self.send("tool_call_end", json!({
            "tool_id": tool_id, "result": result,
            "is_error": is_error, "duration_ms": duration_ms
        }), Some(false), Some(false));
    }

    pub fn send_run_started(&self) {
        self.send("run_started", json!({ "session_id": self.session_id }), Some(false), Some(false));
    }

    pub fn send_run_finished(&self, cost_usd: f64, input_tokens: u32, output_tokens: u32) {
        self.send("run_finished", json!({
            "session_id": self.session_id,
            "cost_usd": cost_usd,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        }), Some(false), Some(true));
    }

    pub fn send_error(&self, message: &str, code: Option<&str>) {
        self.send("error", json!({ "message": message, "code": code }), Some(false), Some(true));
    }

    pub fn send_approval_request(&self, request_id: &str, tool_name: &str, description: &str) {
        self.send("approval_request", json!({
            "request_id": request_id, "tool_name": tool_name, "description": description
        }), Some(false), Some(false));
    }

    pub fn send_staff_agent_start(&self, agent_type: &str, agent_id: &str) {
        self.send("staff_agent_start", json!({
            "agent_type": agent_type, "agent_id": agent_id
        }), Some(false), Some(false));
    }

    pub fn send_staff_agent_end(&self, agent_id: &str, result_summary: &str) {
        self.send("staff_agent_end", json!({
            "agent_id": agent_id, "result_summary": result_summary
        }), Some(false), Some(false));
    }

    pub fn send_cost_update(&self, cost_usd: f64, input_tokens: u32, output_tokens: u32) {
        self.send("cost_update", json!({
            "cost_usd": cost_usd, "input_tokens": input_tokens, "output_tokens": output_tokens
        }), Some(false), Some(false));
    }

    pub fn send_retrying(&self, attempt: u32, reason: &str) {
        self.send("retrying", json!({ "attempt": attempt, "reason": reason }), Some(false), Some(false));
    }
}

#[cfg(test)]
mod tests {
    use super::GatewayBridge;
    use agentii_protocol::gateway::EventFrame;
    use tokio::sync::mpsc;

    fn make_bridge() -> (GatewayBridge, mpsc::Receiver<EventFrame>) {
        let (tx, rx) = mpsc::channel(64);
        let bridge = GatewayBridge::new("test-session-id", tx);
        (bridge, rx)
    }

    fn recv_frame(rx: &mut mpsc::Receiver<EventFrame>) -> EventFrame {
        rx.try_recv().expect("expected a frame in the channel")
    }

    #[test]
    fn send_text_delta_emits_correct_event() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_text_delta("hello world");
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "text_delta");
        assert_eq!(frame.payload["text"], "hello world");
        assert_eq!(frame.stream.as_deref(), Some("true"));
        assert_eq!(frame.done, Some(false));
        assert_eq!(frame.channel.as_deref(), Some("2"));
    }

    #[test]
    fn send_run_started_emits_session_id() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_run_started();
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "run_started");
        assert_eq!(frame.payload["session_id"], "test-session-id");
        assert_eq!(frame.done, Some(false));
    }

    #[test]
    fn send_run_finished_emits_cost_and_tokens_and_done() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_run_finished(0.042, 1000, 200);
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "run_finished");
        assert_eq!(frame.payload["session_id"], "test-session-id");
        assert!((frame.payload["cost_usd"].as_f64().unwrap() - 0.042).abs() < 1e-9);
        assert_eq!(frame.payload["input_tokens"], 1000);
        assert_eq!(frame.payload["output_tokens"], 200);
        assert_eq!(frame.done, Some(true));
    }

    #[test]
    fn send_tool_call_start_emits_tool_metadata() {
        let (bridge, mut rx) = make_bridge();
        let input = serde_json::json!({ "path": "src/main.rs" });
        bridge.send_tool_call_start("read_file", "tool-abc", &input);
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "tool_call_start");
        assert_eq!(frame.payload["tool_name"], "read_file");
        assert_eq!(frame.payload["tool_id"], "tool-abc");
        assert_eq!(frame.payload["input"]["path"], "src/main.rs");
        assert_eq!(frame.done, Some(false));
    }

    #[test]
    fn send_tool_call_end_emits_result_and_error_flag() {
        let (bridge, mut rx) = make_bridge();
        let result = serde_json::json!({ "content": "file contents" });
        bridge.send_tool_call_end("tool-abc", &result, false, 42);
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "tool_call_end");
        assert_eq!(frame.payload["tool_id"], "tool-abc");
        assert_eq!(frame.payload["is_error"], false);
        assert_eq!(frame.payload["duration_ms"], 42);
    }

    #[test]
    fn send_error_emits_message_and_done() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_error("something went wrong", Some("INTERNAL"));
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "error");
        assert_eq!(frame.payload["message"], "something went wrong");
        assert_eq!(frame.payload["code"], "INTERNAL");
        assert_eq!(frame.done, Some(true));
    }

    #[test]
    fn send_approval_request_emits_request_fields() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_approval_request("req-1", "bash", "Run: rm -rf /tmp/scratch");
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "approval_request");
        assert_eq!(frame.payload["request_id"], "req-1");
        assert_eq!(frame.payload["tool_name"], "bash");
        assert_eq!(frame.payload["description"], "Run: rm -rf /tmp/scratch");
        assert_eq!(frame.done, Some(false));
    }

    #[test]
    fn send_staff_agent_start_emits_agent_type_and_id() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_staff_agent_start("Explore", "agent-xyz");
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "staff_agent_start");
        assert_eq!(frame.payload["agent_type"], "Explore");
        assert_eq!(frame.payload["agent_id"], "agent-xyz");
        assert_eq!(frame.done, Some(false));
        assert_eq!(frame.channel.as_deref(), Some("2"));
    }

    #[test]
    fn send_staff_agent_end_emits_agent_id_and_summary() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_staff_agent_end("agent-xyz", "Explored 42 files");
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "staff_agent_end");
        assert_eq!(frame.payload["agent_id"], "agent-xyz");
        assert_eq!(frame.payload["result_summary"], "Explored 42 files");
        assert_eq!(frame.done, Some(false));
    }

    #[test]
    fn send_cost_update_emits_running_totals() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_cost_update(0.01, 500, 100);
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "cost_update");
        assert_eq!(frame.payload["input_tokens"], 500);
        assert_eq!(frame.payload["output_tokens"], 100);
        assert_eq!(frame.done, Some(false));
    }

    #[test]
    fn send_retrying_emits_attempt_and_reason() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_retrying(2, "rate limited");
        let frame = recv_frame(&mut rx);
        assert_eq!(frame.event, "retrying");
        assert_eq!(frame.payload["attempt"], 2);
        assert_eq!(frame.payload["reason"], "rate limited");
        assert_eq!(frame.done, Some(false));
    }

    #[test]
    fn sequence_numbers_increment_monotonically() {
        let (bridge, mut rx) = make_bridge();
        bridge.send_run_started();
        bridge.send_text_delta("chunk 1");
        bridge.send_text_delta("chunk 2");
        bridge.send_run_finished(0.0, 0, 0);

        let seqs: Vec<u64> = (0..4).map(|_| recv_frame(&mut rx).seq).collect();
        assert_eq!(seqs, vec![0, 1, 2, 3]);
    }

    #[test]
    fn staff_agent_start_end_sequence_for_subagent_spawn() {
        // Integration test: verify StaffAgentStart/StaffAgentEnd events are emitted
        // correctly when a sub-agent spawns and completes (T046).
        let (bridge, mut rx) = make_bridge();

        bridge.send_run_started();
        bridge.send_staff_agent_start("Explore", "explore-001");
        bridge.send_text_delta("Exploring codebase...");
        bridge.send_staff_agent_end("explore-001", "Found 12 relevant files");
        bridge.send_run_finished(0.005, 300, 80);

        let run_started = recv_frame(&mut rx);
        assert_eq!(run_started.event, "run_started");

        let agent_start = recv_frame(&mut rx);
        assert_eq!(agent_start.event, "staff_agent_start");
        assert_eq!(agent_start.payload["agent_type"], "Explore");
        assert_eq!(agent_start.payload["agent_id"], "explore-001");

        let text = recv_frame(&mut rx);
        assert_eq!(text.event, "text_delta");

        let agent_end = recv_frame(&mut rx);
        assert_eq!(agent_end.event, "staff_agent_end");
        assert_eq!(agent_end.payload["agent_id"], "explore-001");
        assert_eq!(agent_end.payload["result_summary"], "Found 12 relevant files");

        let run_finished = recv_frame(&mut rx);
        assert_eq!(run_finished.event, "run_finished");
        assert_eq!(run_finished.done, Some(true));
    }

    // --- T039: End-to-end event sequence test ---

    #[test]
    fn e2e_event_sequence_run_started_text_delta_run_finished() {
        // T039: Verify the canonical event sequence: run_started → text_delta* → run_finished.
        // Creates a GatewayBridge, sends events in sequence, and verifies EventFrames are correct.
        let (bridge, mut rx) = make_bridge();

        // Simulate a ConversationRuntime run
        bridge.send_run_started();
        bridge.send_text_delta("Hello, ");
        bridge.send_text_delta("world!");
        bridge.send_run_finished(0.001, 100, 20);

        // run_started
        let f0 = recv_frame(&mut rx);
        assert_eq!(f0.event, "run_started");
        assert_eq!(f0.payload["session_id"], "test-session-id");
        assert_eq!(f0.done, Some(false));
        assert_eq!(f0.channel.as_deref(), Some("2"));
        assert_eq!(f0.seq, 0);

        // text_delta #1
        let f1 = recv_frame(&mut rx);
        assert_eq!(f1.event, "text_delta");
        assert_eq!(f1.payload["text"], "Hello, ");
        assert_eq!(f1.stream.as_deref(), Some("true"));
        assert_eq!(f1.done, Some(false));
        assert_eq!(f1.seq, 1);

        // text_delta #2
        let f2 = recv_frame(&mut rx);
        assert_eq!(f2.event, "text_delta");
        assert_eq!(f2.payload["text"], "world!");
        assert_eq!(f2.seq, 2);

        // run_finished
        let f3 = recv_frame(&mut rx);
        assert_eq!(f3.event, "run_finished");
        assert_eq!(f3.payload["session_id"], "test-session-id");
        assert!((f3.payload["cost_usd"].as_f64().unwrap() - 0.001).abs() < 1e-9);
        assert_eq!(f3.payload["input_tokens"], 100);
        assert_eq!(f3.payload["output_tokens"], 20);
        assert_eq!(f3.done, Some(true));
        assert_eq!(f3.seq, 3);

        // No more frames
        assert!(rx.try_recv().is_err(), "no extra frames expected");
    }

    // --- T036: Abort signal tests ---

    #[test]
    fn abort_signal_starts_unset() {
        let (bridge, _rx) = make_bridge();
        assert!(!bridge.is_aborted());
    }

    #[test]
    fn abort_sets_signal() {
        let (bridge, _rx) = make_bridge();
        bridge.abort();
        assert!(bridge.is_aborted());
    }

    // --- T037: Approval resolution tests ---

    #[test]
    fn resolve_approval_approved_sends_true() {
        let (bridge, _rx) = make_bridge();
        let mut receiver = bridge.register_approval("req-42");
        let resolved = bridge.resolve_approval("req-42", true);
        assert!(resolved, "resolve_approval should return true when request_id found");
        let result = receiver.try_recv().expect("approval result should be ready");
        assert!(result, "approved should be true");
    }

    #[test]
    fn resolve_approval_denied_sends_false() {
        let (bridge, _rx) = make_bridge();
        let mut receiver = bridge.register_approval("req-99");
        let resolved = bridge.resolve_approval("req-99", false);
        assert!(resolved);
        let result = receiver.try_recv().expect("approval result should be ready");
        assert!(!result, "denied should be false");
    }

    #[test]
    fn resolve_approval_unknown_request_id_returns_false() {
        let (bridge, _rx) = make_bridge();
        let resolved = bridge.resolve_approval("nonexistent", true);
        assert!(!resolved, "unknown request_id should return false");
    }

    #[test]
    fn multiple_pending_approvals_resolve_independently() {
        let (bridge, _rx) = make_bridge();
        let mut rx1 = bridge.register_approval("req-1");
        let mut rx2 = bridge.register_approval("req-2");

        bridge.resolve_approval("req-2", false);
        bridge.resolve_approval("req-1", true);

        assert!(rx1.try_recv().unwrap(), "req-1 should be approved");
        assert!(!rx2.try_recv().unwrap(), "req-2 should be denied");
    }
}
