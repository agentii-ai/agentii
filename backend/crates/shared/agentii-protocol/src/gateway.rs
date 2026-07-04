use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Client → Server request frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestFrame {
    #[serde(rename = "type")]
    pub frame_type: String, // always "req"
    pub id: String,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

/// Server → Client response frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseFrame {
    #[serde(rename = "type")]
    pub frame_type: String, // always "res"
    pub id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorShape>,
}

impl ResponseFrame {
    pub fn success(id: String, payload: Value) -> Self {
        Self {
            frame_type: "res".into(),
            id,
            ok: true,
            payload: Some(payload),
            error: None,
        }
    }

    pub fn error(id: String, code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            frame_type: "res".into(),
            id,
            ok: false,
            payload: None,
            error: Some(ErrorShape {
                code: code.into(),
                message: message.into(),
            }),
        }
    }
}

/// Server → Client event frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventFrame {
    #[serde(rename = "type")]
    pub frame_type: String, // always "event"
    pub event: String,
    pub payload: Value,
    pub seq: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub done: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
}

/// Error shape in response frames.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorShape {
    pub code: String,
    pub message: String,
}

/// Client identification in connect handshake.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub id: String,
    pub version: String,
    pub platform: String,
    pub mode: String,
}

/// Protocol version range.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolVersion {
    pub min: u32,
    pub max: u32,
}

/// Connect handshake params.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectParams {
    pub protocol: ProtocolVersion,
    pub client: ClientInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
}

/// Connect handshake response payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResponse {
    #[serde(rename = "type")]
    pub response_type: String, // "hello-ok"
    pub server: ServerInfo,
    pub session_key: String,
    pub features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
}

/// Known error codes.
pub mod error_codes {
    pub const PROTOCOL_ERROR: &str = "PROTOCOL_ERROR";
    pub const INVALID_REQUEST: &str = "INVALID_REQUEST";
    pub const FORBIDDEN: &str = "FORBIDDEN";
    pub const NOT_FOUND: &str = "NOT_FOUND";
    pub const RATE_LIMITED: &str = "RATE_LIMITED";
    pub const INTERNAL: &str = "INTERNAL";
    pub const PROVIDER_ERROR: &str = "PROVIDER_ERROR";
    pub const CONTEXT_OVERFLOW: &str = "CONTEXT_OVERFLOW";
}
