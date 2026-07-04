//! Native Rust financial Tool implementations for agentii-rust-core.
//! Registered in GlobalToolRegistry under the "Financial" and "Excel" categories.

pub mod company;
pub mod market_context;
pub mod orders;
pub mod retrieval;
pub mod statements;
pub mod xlsx;
pub mod xlsx_errors;

pub use company::fetch_stock_info_spec;
pub use market_context::read_market_context_spec;
pub use orders::stage_order_spec;
pub use retrieval::{
    fetch_document_chunk_content_spec, fetch_document_outline_spec,
    fetch_filtered_document_names_spec, search_keyword_in_source_spec,
};
pub use statements::fetch_financial_statement_spec;
pub use xlsx::{
    excel_tool_specs, xlsx_audit_spec, xlsx_build_spec, xlsx_convert_spec,
    xlsx_evaluate_spec, xlsx_recalc_spec,
};

use agentii_data_api::DataApiClient;

/// Returns all 13 ToolSpec-compatible JSON definitions (8 financial retrieval + 5 Excel).
/// Call this from agentii-tools mvp_tool_specs() to register all tools.
pub fn financial_tool_specs() -> Vec<serde_json::Value> {
    let mut specs = vec![
        fetch_filtered_document_names_spec(),
        fetch_document_outline_spec(),
        fetch_document_chunk_content_spec(),
        search_keyword_in_source_spec(),
        fetch_financial_statement_spec(),
        fetch_stock_info_spec(),
        read_market_context_spec(),
        stage_order_spec(),
    ];
    specs.extend(excel_tool_specs());
    specs
}

/// Execute a financial tool by name. Returns JSON result or error string.
pub fn execute_financial_tool(
    name: &str,
    input: &serde_json::Value,
    workspace_root: &str,
) -> Result<serde_json::Value, String> {
    let client = DataApiClient::from_env();
    match name {
        "fetch_filtered_document_names" => retrieval::fetch_filtered_document_names(&client, input),
        "fetch_document_outline" => retrieval::fetch_document_outline(&client, input),
        "fetch_document_chunk_content" => retrieval::fetch_document_chunk_content(&client, input),
        "search_keyword_in_source" => retrieval::search_keyword_in_source(&client, input),
        "fetch_financial_statement" => statements::fetch_financial_statement(&client, input),
        "fetch_stock_info" => company::fetch_stock_info(&client, input),
        "read_market_context" => market_context::read_market_context(workspace_root, input),
        "stage_order" => orders::stage_order(workspace_root, input),
        // Excel tools
        "xlsx_recalc" => xlsx::xlsx_recalc(workspace_root, input),
        "xlsx_evaluate" => xlsx::xlsx_evaluate(workspace_root, input, None),
        "xlsx_audit" => xlsx::xlsx_audit(workspace_root, input),
        "xlsx_convert" => xlsx::xlsx_convert(workspace_root, input),
        "xlsx_build" => xlsx::xlsx_build(workspace_root, input),
        _ => Err(format!("Unknown financial tool: {name}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    // Helper: extract a string field from a spec Value.
    fn spec_str<'a>(spec: &'a Value, key: &str) -> &'a str {
        spec[key].as_str().unwrap_or("")
    }

    // --- Tool spec export tests ---

    #[test]
    fn financial_tool_specs_returns_13_entries() {
        let specs = financial_tool_specs();
        assert_eq!(specs.len(), 13, "expected 13 tool specs (8 financial + 5 Excel)");
    }

    #[test]
    fn all_specs_have_name_and_description() {
        for spec in financial_tool_specs() {
            let name = spec_str(&spec, "name");
            assert!(!name.is_empty(), "spec missing name: {spec}");
            let desc = spec_str(&spec, "description");
            assert!(!desc.is_empty(), "spec '{name}' missing description");
        }
    }

    #[test]
    fn all_specs_have_readonly_or_readwrite_permission() {
        for spec in financial_tool_specs() {
            let perm = spec_str(&spec, "permission");
            assert!(
                perm == "ReadOnly" || perm == "ReadWrite" || perm == "WorkspaceWrite",
                "spec '{}' has unexpected permission '{perm}'",
                spec_str(&spec, "name")
            );
        }
    }

    #[test]
    fn fetch_filtered_document_names_spec_is_correct() {
        let spec = fetch_filtered_document_names_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_filtered_document_names");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        assert!(spec["input_schema"]["properties"]["ticker"].is_object());
    }

    #[test]
    fn fetch_document_outline_spec_is_correct() {
        let spec = fetch_document_outline_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_document_outline");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        assert!(spec["input_schema"]["required"].as_array().unwrap().contains(&Value::String("source_id".into())));
    }

    #[test]
    fn fetch_document_chunk_content_spec_is_correct() {
        let spec = fetch_document_chunk_content_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_document_chunk_content");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("source_id".into())));
        assert!(required.contains(&Value::String("row_numbers".into())));
    }

    #[test]
    fn fetch_stock_info_spec_is_correct() {
        let spec = fetch_stock_info_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_stock_info");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        assert!(spec["input_schema"]["required"].as_array().unwrap().contains(&Value::String("ticker".into())));
    }

    #[test]
    fn fetch_financial_statement_spec_is_correct() {
        let spec = fetch_financial_statement_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_financial_statement");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
    }

    #[test]
    fn read_market_context_spec_is_correct() {
        let spec = read_market_context_spec();
        assert_eq!(spec_str(&spec, "name"), "read_market_context");
    }

    #[test]
    fn stage_order_spec_is_correct() {
        let spec = stage_order_spec();
        assert_eq!(spec_str(&spec, "name"), "stage_order");
    }

    // --- execute_financial_tool dispatch tests ---

    #[test]
    fn execute_unknown_tool_returns_error() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("nonexistent_tool", &input, "/tmp");
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("Unknown financial tool"), "unexpected error: {msg}");
    }

    #[test]
    fn execute_fetch_stock_info_missing_ticker_returns_error() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("fetch_stock_info", &input, "/tmp");
        assert!(result.is_err(), "expected error for missing ticker");
    }

    #[test]
    fn execute_fetch_document_outline_missing_source_id_returns_error() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("fetch_document_outline", &input, "/tmp");
        assert!(result.is_err(), "expected error for missing source_id");
    }

    #[test]
    fn execute_fetch_document_chunk_content_missing_fields_returns_error() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("fetch_document_chunk_content", &input, "/tmp");
        assert!(result.is_err(), "expected error for missing fields");
    }

    #[test]
    #[test]
    fn execute_read_market_context_no_snapshot_returns_ok() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("read_market_context", &input, "/tmp");
        // When no snapshot file exists, returns Ok with a status message (not an error).
        assert!(result.is_ok(), "expected ok for missing snapshot, got: {result:?}");
    }

    #[test]
    fn execute_stage_order_missing_fields_returns_error() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("stage_order", &input, "/tmp");
        assert!(result.is_err(), "expected error for missing fields");
    }

    // --- Excel tool tests ---

    #[test]
    fn excel_tool_specs_returns_five_entries() {
        let specs = excel_tool_specs();
        assert_eq!(specs.len(), 5, "expected 5 Excel tool specs");
    }

    #[test]
    fn xlsx_recalc_spec_is_correct() {
        let spec = xlsx_recalc_spec();
        assert_eq!(spec["name"], "xlsx_recalc");
        assert_eq!(spec["permission"], "ReadOnly");
        assert_eq!(spec["category"], "Excel");
        assert!(spec["input_schema"]["required"].as_array().unwrap().contains(&Value::String("path".into())));
    }

    #[test]
    fn xlsx_evaluate_spec_is_correct() {
        let spec = xlsx_evaluate_spec();
        assert_eq!(spec["name"], "xlsx_evaluate");
        assert_eq!(spec["permission"], "ReadOnly");
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("path".into())));
        assert!(required.contains(&Value::String("cell_ref".into())));
    }

    #[test]
    fn xlsx_audit_spec_is_correct() {
        let spec = xlsx_audit_spec();
        assert_eq!(spec["name"], "xlsx_audit");
        assert_eq!(spec["permission"], "ReadOnly");
    }

    #[test]
    fn xlsx_convert_spec_is_correct() {
        let spec = xlsx_convert_spec();
        assert_eq!(spec["name"], "xlsx_convert");
        assert_eq!(spec["permission"], "ReadOnly");
        let allowed = spec["input_schema"]["properties"]["format"]["enum"].as_array().unwrap();
        assert!(allowed.contains(&Value::String("csv".into())));
        assert!(allowed.contains(&Value::String("parquet".into())));
    }

    #[test]
    fn xlsx_build_spec_is_correct() {
        let spec = xlsx_build_spec();
        assert_eq!(spec["name"], "xlsx_build");
        assert_eq!(spec["permission"], "WorkspaceWrite");
        let methods = spec["input_schema"]["properties"]["method"]["enum"].as_array().unwrap();
        assert!(methods.contains(&Value::String("script".into())));
        assert!(methods.contains(&Value::String("spec".into())));
    }

    #[test]
    fn excel_tool_dispatch_keys_recognised() {
        for spec in excel_tool_specs() {
            let name = spec["name"].as_str().unwrap();
            let empty = serde_json::json!({});
            let result = execute_financial_tool(name, &empty, "/tmp");
            if let Err(msg) = result {
                assert!(
                    !msg.contains("Unknown financial tool"),
                    "dispatch missing for Excel tool '{name}': {msg}"
                );
            }
        }
    }

    #[test]
    fn xlsx_recalc_missing_path_returns_error() {
        let input = serde_json::json!({});
        let result = execute_financial_tool("xlsx_recalc", &input, "/tmp");
        assert!(result.is_err(), "expected error for missing path");
    }

    #[test]
    fn xlsx_evaluate_invalid_cell_ref_returns_error() {
        let input = serde_json::json!({"path": "test.xlsx", "cell_ref": "; rm -rf /"});
        let result = execute_financial_tool("xlsx_evaluate", &input, "/tmp");
        assert!(result.is_err(), "expected error for invalid cell_ref");
    }

    #[test]
    fn xlsx_build_invalid_method_returns_error() {
        let input = serde_json::json!({"method": "invalid_method"});
        let result = execute_financial_tool("xlsx_build", &input, "/tmp");
        assert!(result.is_err(), "expected error for unknown method");
    }

    #[test]
    fn xlsx_convert_unsupported_format_returns_error() {
        let input = serde_json::json!({"path": "test.xlsx", "format": "docx"});
        let result = execute_financial_tool("xlsx_convert", &input, "/tmp");
        assert!(result.is_err(), "expected error for unsupported format");
        assert!(result.unwrap_err().contains("Unsupported format"));
    }

    #[test]
    fn spec_names_match_dispatch_keys() {
        // Every spec name should be a recognised dispatch key (not return "Unknown financial tool")
        let known_names: Vec<String> = financial_tool_specs()
            .into_iter()
            .map(|s| s["name"].as_str().unwrap_or("").to_string())
            .collect();
        let empty_input = serde_json::json!({});
        for name in &known_names {
            let result = execute_financial_tool(name, &empty_input, "/tmp");
            // We expect either Ok or a domain error — NOT "Unknown financial tool"
            if let Err(msg) = result {
                assert!(
                    !msg.contains("Unknown financial tool"),
                    "dispatch missing for spec name '{name}': {msg}"
                );
            }
        }
    }
}
