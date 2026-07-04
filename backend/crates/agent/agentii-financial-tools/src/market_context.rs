//! Read market context snapshot injected by the IDE frontend.
use serde_json::{json, Value};
use std::path::Path;

pub fn read_market_context_spec() -> Value {
    json!({
        "name": "read_market_context",
        "description": "Read the current market context snapshot injected by the agentii IDE frontend. Contains: active ticker, current quote (bid/ask/last), OHLCV bars, selected chart time range. Use to understand what the user is currently viewing in the trading panel.",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    })
}

pub fn read_market_context(workspace_root: &str, _input: &Value) -> Result<Value, String> {
    let path = Path::new(workspace_root)
        .join(".agentii")
        .join("market-context")
        .join("snapshot.json");

    if !path.exists() {
        return Ok(json!({
            "status": "no_market_context",
            "message": "No market context available. Open a trading view in the agentii IDE and link it to this project."
        }));
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("read_market_context: failed to read snapshot: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("read_market_context: parse error: {e}"))
}

// T071: Unit tests for market context tool spec — verify name, description, schema.
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn spec_str<'a>(spec: &'a Value, key: &str) -> &'a str {
        spec[key].as_str().unwrap_or("")
    }

    #[test]
    fn read_market_context_spec_has_correct_name_and_description() {
        let spec = read_market_context_spec();
        assert_eq!(spec_str(&spec, "name"), "read_market_context");
        assert!(!spec_str(&spec, "description").is_empty());
        assert_eq!(spec_str(&spec, "category"), "Financial");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
    }

    #[test]
    fn read_market_context_spec_has_empty_properties() {
        let spec = read_market_context_spec();
        assert_eq!(spec["input_schema"]["type"], "object");
        // No required fields
        assert!(spec["input_schema"]["required"].is_null());
    }

    #[test]
    fn read_market_context_returns_no_context_when_snapshot_missing() {
        let result = read_market_context("/tmp/nonexistent_workspace_xyz", &json!({}));
        assert!(result.is_ok());
        let val = result.unwrap();
        assert_eq!(val["status"], "no_market_context");
    }

    #[test]
    fn read_market_context_returns_parsed_json_when_snapshot_exists() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos();
        let workspace = std::env::temp_dir().join(format!("agentii-mkt-ctx-test-{nanos}"));
        let snapshot_dir = workspace.join(".agentii").join("market-context");
        fs::create_dir_all(&snapshot_dir).unwrap();
        let snapshot_path = snapshot_dir.join("snapshot.json");
        fs::write(&snapshot_path, r#"{"ticker":"NVDA","last":900.0}"#).unwrap();

        let result = read_market_context(workspace.to_str().unwrap(), &json!({}));
        assert!(result.is_ok());
        let val = result.unwrap();
        assert_eq!(val["ticker"], "NVDA");
        assert!((val["last"].as_f64().unwrap() - 900.0).abs() < 1e-9);

        fs::remove_dir_all(&workspace).ok();
    }
}
