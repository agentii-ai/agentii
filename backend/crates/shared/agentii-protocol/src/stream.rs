use serde::{Deserialize, Serialize};

use crate::messages::Usage;

/// Events emitted during LLM streaming.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "text_delta")]
    TextDelta { text: String },

    #[serde(rename = "tool_call_start")]
    ToolCallStart {
        id: String,
        name: String,
    },

    #[serde(rename = "tool_call_delta")]
    ToolCallDelta {
        id: String,
        arguments_chunk: String,
    },

    #[serde(rename = "tool_call_end")]
    ToolCallEnd { id: String },

    #[serde(rename = "thinking_delta")]
    ThinkingDelta { text: String },

    #[serde(rename = "usage")]
    Usage(Usage),

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "done")]
    Done,
}
