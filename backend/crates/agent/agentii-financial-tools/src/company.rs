//! Company profile / stock info tool.
use agentii_data_api::DataApiClient;
use serde_json::{json, Value};

pub fn fetch_stock_info_spec() -> Value {
    json!({
        "name": "fetch_stock_info",
        "description": "Get company profile and metadata for a ticker: name, sector, industry, market cap, exchange, description. Use for company background context.",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol, e.g. NVDA"}
            },
            "required": ["ticker"]
        }
    })
}

pub fn fetch_stock_info(client: &DataApiClient, input: &Value) -> Result<Value, String> {
    let ticker = input["ticker"].as_str().ok_or("missing ticker")?;
    match client.get_company_profile(ticker) {
        Ok(profile) => Ok(json!(profile)),
        Err(e) => Err(format!("fetch_stock_info error: {e}")),
    }
}

// T071: Unit tests for company tool spec — verify name, description, schema.
#[cfg(test)]
mod tests {
    use super::*;

    fn spec_str<'a>(spec: &'a Value, key: &str) -> &'a str {
        spec[key].as_str().unwrap_or("")
    }

    #[test]
    fn fetch_stock_info_spec_has_correct_name_and_description() {
        let spec = fetch_stock_info_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_stock_info");
        assert!(!spec_str(&spec, "description").is_empty());
        assert_eq!(spec_str(&spec, "category"), "Financial");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
    }

    #[test]
    fn fetch_stock_info_spec_requires_ticker() {
        let spec = fetch_stock_info_spec();
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("ticker".into())));
        assert!(spec["input_schema"]["properties"]["ticker"].is_object());
        assert_eq!(spec["input_schema"]["properties"]["ticker"]["type"], "string");
    }

    #[test]
    fn fetch_stock_info_missing_ticker_returns_error() {
        let client = DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({});
        let result = fetch_stock_info(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing ticker");
    }
}
