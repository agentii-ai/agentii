//! Order staging tool — writes staged orders for IDE confirmation.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;

pub fn stage_order_spec() -> Value {
    json!({
        "name": "stage_order",
        "description": "Stage a trade order for human confirmation in the agentii IDE. The order is NOT submitted — it is written to .agentii/orders/staged.json and the IDE will show a confirmation dialog. Use ONLY when the user explicitly asks to place a trade.",
        "category": "Financial",
        "permission": "WorkspaceWrite",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Ticker symbol, e.g. NVDA"},
                "side": {"type": "string", "enum": ["buy", "sell"], "description": "Order side"},
                "qty": {"type": "number", "description": "Number of shares or contracts"},
                "price": {"type": "number", "description": "Limit price (null for market order)"},
                "order_type": {"type": "string", "enum": ["market", "limit", "stop", "stop_limit"], "description": "Order type"},
                "rationale": {"type": "string", "description": "Brief explanation of why this trade is being staged"}
            },
            "required": ["symbol", "side", "qty"]
        }
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StagedOrder {
    pub symbol: String,
    pub side: String,
    pub qty: f64,
    pub price: Option<f64>,
    pub order_type: String,
    pub rationale: Option<String>,
    pub staged_at: String,
    pub status: String,
}

pub fn stage_order(workspace_root: &str, input: &Value) -> Result<Value, String> {
    let symbol = input["symbol"].as_str().ok_or("missing symbol")?.to_string();
    let side = input["side"].as_str().ok_or("missing side")?.to_string();
    let qty = input["qty"].as_f64().ok_or("missing qty")?;
    let price = input["price"].as_f64();
    let order_type = input["order_type"].as_str().unwrap_or("market").to_string();
    let rationale = input["rationale"].as_str().map(String::from);

    let order = StagedOrder {
        symbol: symbol.clone(),
        side: side.clone(),
        qty,
        price,
        order_type,
        rationale,
        staged_at: chrono_now(),
        status: "pending_confirmation".to_string(),
    };

    let dir = Path::new(workspace_root).join(".agentii").join("orders");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("stage_order: failed to create orders dir: {e}"))?;

    let path = dir.join("staged.json");
    let content = serde_json::to_string_pretty(&order)
        .map_err(|e| format!("stage_order: serialize error: {e}"))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("stage_order: write error: {e}"))?;

    Ok(json!({
        "status": "staged",
        "message": format!("Order staged for confirmation: {} {} {} shares of {}", side, qty, if price.is_some() { "@ limit" } else { "@ market" }, symbol),
        "order": order,
        "confirmation_required": true
    }))
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("{secs}")
}

// T071: Unit tests for stage_order tool spec — verify name, description, schema.
#[cfg(test)]
mod tests {
    use super::*;

    fn spec_str<'a>(spec: &'a Value, key: &str) -> &'a str {
        spec[key].as_str().unwrap_or("")
    }

    #[test]
    fn stage_order_spec_has_correct_name_and_description() {
        let spec = stage_order_spec();
        assert_eq!(spec_str(&spec, "name"), "stage_order");
        assert!(!spec_str(&spec, "description").is_empty());
        assert_eq!(spec_str(&spec, "category"), "Financial");
        assert_eq!(spec_str(&spec, "permission"), "WorkspaceWrite");
    }

    #[test]
    fn stage_order_spec_requires_symbol_side_qty() {
        let spec = stage_order_spec();
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("symbol".into())));
        assert!(required.contains(&Value::String("side".into())));
        assert!(required.contains(&Value::String("qty".into())));
    }

    #[test]
    fn stage_order_spec_side_has_enum_values() {
        let spec = stage_order_spec();
        let enum_vals = spec["input_schema"]["properties"]["side"]["enum"]
            .as_array()
            .unwrap();
        let vals: Vec<&str> = enum_vals.iter().filter_map(|v| v.as_str()).collect();
        assert!(vals.contains(&"buy"));
        assert!(vals.contains(&"sell"));
    }

    #[test]
    fn stage_order_spec_order_type_has_enum_values() {
        let spec = stage_order_spec();
        let enum_vals = spec["input_schema"]["properties"]["order_type"]["enum"]
            .as_array()
            .unwrap();
        let vals: Vec<&str> = enum_vals.iter().filter_map(|v| v.as_str()).collect();
        assert!(vals.contains(&"market"));
        assert!(vals.contains(&"limit"));
        assert!(vals.contains(&"stop"));
        assert!(vals.contains(&"stop_limit"));
    }

    #[test]
    fn stage_order_missing_symbol_returns_error() {
        let input = serde_json::json!({});
        let result = stage_order("/tmp", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing symbol");
    }

    #[test]
    fn stage_order_missing_side_returns_error() {
        let input = serde_json::json!({ "symbol": "NVDA" });
        let result = stage_order("/tmp", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing side");
    }

    #[test]
    fn stage_order_missing_qty_returns_error() {
        let input = serde_json::json!({ "symbol": "NVDA", "side": "buy" });
        let result = stage_order("/tmp", &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing qty");
    }

    #[test]
    fn stage_order_writes_staged_json_and_returns_ok() {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos();
        let workspace = std::env::temp_dir().join(format!("agentii-order-test-{nanos}"));
        std::fs::create_dir_all(&workspace).unwrap();

        let input = serde_json::json!({
            "symbol": "NVDA",
            "side": "buy",
            "qty": 10.0,
            "order_type": "limit",
            "price": 900.0,
            "rationale": "test order"
        });
        let result = stage_order(workspace.to_str().unwrap(), &input);
        assert!(result.is_ok(), "stage_order should succeed: {result:?}");
        let val = result.unwrap();
        assert_eq!(val["status"], "staged");
        assert_eq!(val["confirmation_required"], true);

        // Verify the file was written
        let staged_path = workspace.join(".agentii").join("orders").join("staged.json");
        assert!(staged_path.exists(), "staged.json should be written");
        let content = std::fs::read_to_string(&staged_path).unwrap();
        let order: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(order["symbol"], "NVDA");
        assert_eq!(order["side"], "buy");
        assert_eq!(order["status"], "pending_confirmation");

        std::fs::remove_dir_all(&workspace).ok();
    }
}
