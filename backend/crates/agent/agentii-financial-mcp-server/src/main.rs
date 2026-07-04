//! MCP stdio server exposing the 8 agentii financial tools.
//!
//! Reads JSON-RPC 2.0 requests from stdin, dispatches to financial tools,
//! writes JSON-RPC 2.0 responses to stdout. Handles:
//!   - `initialize`
//!   - `tools/list`
//!   - `tools/call`

use std::io::{self, BufRead, Write};

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RpcId {
    Number(u64),
    Str(String),
    Null,
}

impl Serialize for RpcId {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            RpcId::Number(n) => s.serialize_u64(*n),
            RpcId::Str(st) => s.serialize_str(st),
            RpcId::Null => s.serialize_none(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct RpcRequest {
    #[allow(dead_code)]
    jsonrpc: String,
    id: Option<RpcId>,
    method: String,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct RpcResponse {
    jsonrpc: &'static str,
    id: Option<RpcId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcError>,
}

#[derive(Debug, Serialize)]
struct RpcError {
    code: i64,
    message: String,
}

impl RpcResponse {
    fn ok(id: Option<RpcId>, result: Value) -> Self {
        Self { jsonrpc: "2.0", id, result: Some(result), error: None }
    }

    fn err(id: Option<RpcId>, code: i64, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: None,
            error: Some(RpcError { code, message: message.into() }),
        }
    }
}

// ---------------------------------------------------------------------------
// MCP tool schema helpers
// ---------------------------------------------------------------------------

fn mcp_tools_list() -> Value {
    let specs = agentii_financial_tools::financial_tool_specs();
    let tools: Vec<Value> = specs
        .into_iter()
        .map(|spec| {
            serde_json::json!({
                "name": spec["name"],
                "description": spec["description"],
                "inputSchema": spec["input_schema"],
            })
        })
        .collect();
    serde_json::json!({ "tools": tools })
}

// ---------------------------------------------------------------------------
// Request dispatch
// ---------------------------------------------------------------------------

fn handle_request(req: RpcRequest) -> RpcResponse {
    match req.method.as_str() {
        "initialize" => {
            let result = serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": {
                    "name": "agentii-financial-mcp-server",
                    "version": env!("CARGO_PKG_VERSION"),
                }
            });
            RpcResponse::ok(req.id, result)
        }

        "notifications/initialized" => {
            // No response needed for notifications, but we return nothing meaningful.
            // We skip writing a response for notifications (id is None).
            RpcResponse::ok(req.id, Value::Null)
        }

        "tools/list" => RpcResponse::ok(req.id, mcp_tools_list()),

        "tools/call" => {
            let params = req.params.unwrap_or(Value::Null);
            let name = match params["name"].as_str() {
                Some(n) => n.to_string(),
                None => {
                    return RpcResponse::err(req.id, -32602, "missing 'name' in params");
                }
            };
            let arguments = params["arguments"].clone();
            let workspace_root = std::env::var("AGENTII_WORKSPACE_ROOT")
                .unwrap_or_else(|_| ".".to_string());

            match agentii_financial_tools::execute_financial_tool(&name, &arguments, &workspace_root) {
                Ok(output) => {
                    let result = serde_json::json!({
                        "content": [{ "type": "text", "text": output.to_string() }],
                        "isError": false,
                    });
                    RpcResponse::ok(req.id, result)
                }
                Err(e) => {
                    let result = serde_json::json!({
                        "content": [{ "type": "text", "text": e }],
                        "isError": true,
                    });
                    RpcResponse::ok(req.id, result)
                }
            }
        }

        other => RpcResponse::err(req.id, -32601, format!("method not found: {other}")),
    }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = io::BufWriter::new(stdout.lock());

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = match serde_json::from_str::<RpcRequest>(trimmed) {
            Ok(req) => {
                // Notifications have no id — skip writing a response.
                if req.id.is_none() && req.method.starts_with("notifications/") {
                    continue;
                }
                handle_request(req)
            }
            Err(e) => RpcResponse::err(None, -32700, format!("parse error: {e}")),
        };

        if let Ok(json) = serde_json::to_string(&response) {
            let _ = writeln!(out, "{json}");
            let _ = out.flush();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_req(method: &str, params: Option<Value>) -> RpcRequest {
        RpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(RpcId::Number(1)),
            method: method.into(),
            params,
        }
    }

    #[test]
    fn initialize_returns_server_info() {
        let resp = handle_request(make_req("initialize", None));
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert_eq!(result["serverInfo"]["name"], "agentii-financial-mcp-server");
        assert!(result["capabilities"]["tools"].is_object());
    }

    #[test]
    fn tools_list_returns_eight_tools() {
        let resp = handle_request(make_req("tools/list", None));
        assert!(resp.error.is_none());
        let tools = resp.result.unwrap()["tools"].as_array().unwrap().len();
        assert_eq!(tools, 8);
    }

    #[test]
    fn tools_call_unknown_tool_returns_is_error() {
        let params = serde_json::json!({ "name": "nonexistent", "arguments": {} });
        let resp = handle_request(make_req("tools/call", Some(params)));
        assert!(resp.error.is_none());
        let result = resp.result.unwrap();
        assert_eq!(result["isError"], true);
    }

    #[test]
    fn tools_call_missing_name_returns_rpc_error() {
        let params = serde_json::json!({ "arguments": {} });
        let resp = handle_request(make_req("tools/call", Some(params)));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32602);
    }

    #[test]
    fn unknown_method_returns_method_not_found() {
        let resp = handle_request(make_req("foo/bar", None));
        assert!(resp.error.is_some());
        assert_eq!(resp.error.unwrap().code, -32601);
    }
}
