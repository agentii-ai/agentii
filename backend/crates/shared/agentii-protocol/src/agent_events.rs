use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Structured agent events for Channel 2 (agentii serve → IDE frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentEvent {
    /// Incremental text from LLM response.
    #[serde(rename = "text_delta")]
    TextDelta {
        run_id: String,
        text: String,
        message_index: u32,
    },

    /// Tool execution starting.
    #[serde(rename = "tool_call_start")]
    ToolCallStart {
        run_id: String,
        tool_call_id: String,
        name: String,
        arguments: Value,
    },

    /// Tool execution completed.
    #[serde(rename = "tool_call_end")]
    ToolCallEnd {
        run_id: String,
        tool_call_id: String,
        result: String,
        is_error: bool,
        duration_ms: u64,
    },

    /// Extended thinking started.
    #[serde(rename = "thinking_start")]
    ThinkingStart { run_id: String },

    /// Extended thinking content.
    #[serde(rename = "thinking_delta")]
    ThinkingDelta { run_id: String, text: String },

    /// Sub-agent spawned.
    #[serde(rename = "staff_agent_start")]
    StaffAgentStart {
        run_id: String,
        agent_name: String,
        period: String,
    },

    /// Sub-agent completed.
    #[serde(rename = "staff_agent_end")]
    StaffAgentEnd {
        run_id: String,
        agent_name: String,
        period: String,
        success: bool,
    },

    /// Transient error retry.
    #[serde(rename = "retrying")]
    Retrying {
        run_id: String,
        error: String,
        delay_ms: u64,
        attempt: u32,
    },

    /// Token usage update.
    #[serde(rename = "cost_update")]
    CostUpdate {
        run_id: String,
        input_tokens: u32,
        output_tokens: u32,
    },

    /// Agent loop started.
    #[serde(rename = "run_started")]
    RunStarted {
        run_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        session_key: Option<String>,
    },

    /// Agent loop completed.
    #[serde(rename = "run_finished")]
    RunFinished {
        run_id: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        session_key: Option<String>,
        success: bool,
    },

    /// Fatal error.
    #[serde(rename = "error")]
    Error { run_id: String, error: String },

    /// Approval request (agent → IDE).
    #[serde(rename = "approval_request")]
    ApprovalRequest {
        run_id: String,
        tool_name: String,
        arguments: Value,
        description: String,
    },

    /// Generative UI content.
    #[serde(rename = "generative_ui")]
    GenerativeUI {
        run_id: String,
        component: String,
        props: Value,
    },
}
