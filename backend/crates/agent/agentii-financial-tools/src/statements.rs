//! Financial statement tool.
use agentii_data_api::DataApiClient;
use serde_json::{json, Value};

pub fn fetch_financial_statement_spec() -> Value {
    json!({
        "name": "fetch_financial_statement",
        "description": "Fetch structured financial statements (income statement, balance sheet, cash flow) for a ticker and fiscal periods. Returns markdown-formatted tables. Use for quantitative financial analysis.",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol, e.g. NVDA"},
                "statement_type": {
                    "type": "string",
                    "enum": ["income_statement", "balance_sheet", "cash_flow"],
                    "description": "Type of financial statement"
                },
                "fiscal_periods": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Fiscal periods, e.g. [\"FY2024\", \"FY2023\", \"Q3FY2024\"]"
                }
            },
            "required": ["ticker", "statement_type", "fiscal_periods"]
        }
    })
}

pub fn fetch_financial_statement(client: &DataApiClient, input: &Value) -> Result<Value, String> {
    let ticker = input["ticker"].as_str().ok_or("missing ticker")?;
    let statement_type = input["statement_type"].as_str().ok_or("missing statement_type")?;
    let periods: Vec<&str> = input["fiscal_periods"]
        .as_array()
        .ok_or("missing fiscal_periods")?
        .iter()
        .filter_map(|v| v.as_str())
        .collect();

    let path = format!("/v1/financials/{ticker}/statements/{statement_type}");
    let resp = client.get(&path)
        .query(&[("periods", periods.join(","))])
        .send()
        .map_err(|e| format!("HTTP error: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("fetch_financial_statement error: HTTP {}", resp.status()));
    }
    resp.json::<Value>().map_err(|e| format!("parse error: {e}"))
}

// T071: Unit tests for financial statement tool spec — verify name, description, schema.
#[cfg(test)]
mod tests {
    use super::*;

    fn spec_str<'a>(spec: &'a Value, key: &str) -> &'a str {
        spec[key].as_str().unwrap_or("")
    }

    #[test]
    fn fetch_financial_statement_spec_has_correct_name_and_description() {
        let spec = fetch_financial_statement_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_financial_statement");
        assert!(!spec_str(&spec, "description").is_empty());
        assert_eq!(spec_str(&spec, "category"), "Financial");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
    }

    #[test]
    fn fetch_financial_statement_spec_requires_ticker_statement_type_and_fiscal_periods() {
        let spec = fetch_financial_statement_spec();
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("ticker".into())));
        assert!(required.contains(&Value::String("statement_type".into())));
        assert!(required.contains(&Value::String("fiscal_periods".into())));
    }

    #[test]
    fn fetch_financial_statement_spec_statement_type_has_enum_values() {
        let spec = fetch_financial_statement_spec();
        let enum_vals = spec["input_schema"]["properties"]["statement_type"]["enum"]
            .as_array()
            .unwrap();
        let vals: Vec<&str> = enum_vals.iter().filter_map(|v| v.as_str()).collect();
        assert!(vals.contains(&"income_statement"));
        assert!(vals.contains(&"balance_sheet"));
        assert!(vals.contains(&"cash_flow"));
    }

    #[test]
    fn fetch_financial_statement_spec_fiscal_periods_is_array_of_strings() {
        let spec = fetch_financial_statement_spec();
        assert_eq!(spec["input_schema"]["properties"]["fiscal_periods"]["type"], "array");
        assert_eq!(spec["input_schema"]["properties"]["fiscal_periods"]["items"]["type"], "string");
    }

    #[test]
    fn fetch_financial_statement_missing_ticker_returns_error() {
        let client = DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({});
        let result = fetch_financial_statement(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing ticker");
    }

    #[test]
    fn fetch_financial_statement_missing_statement_type_returns_error() {
        let client = DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({ "ticker": "NVDA" });
        let result = fetch_financial_statement(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing statement_type");
    }

    #[test]
    fn fetch_financial_statement_missing_fiscal_periods_returns_error() {
        let client = DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({ "ticker": "NVDA", "statement_type": "income_statement" });
        let result = fetch_financial_statement(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing fiscal_periods");
    }
}
