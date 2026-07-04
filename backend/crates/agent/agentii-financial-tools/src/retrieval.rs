//! Financial document retrieval tools.
use agentii_data_api::{DataApiClient, ListSourcesParams};
use serde_json::{json, Value};

pub fn fetch_filtered_document_names_spec() -> Value {
    json!({
        "name": "fetch_filtered_document_names",
        "description": "List available financial documents filtered by ticker, year, source type, or date range. Use this FIRST to discover what documents are available before fetching content. Do NOT use for fetching actual document content.",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol, e.g. NVDA"},
                "year": {"type": "integer", "description": "Fiscal year, e.g. 2024"},
                "source_type": {"type": "string", "description": "Document type: sec_10k, sec_10q, sec_8k, sec_13f, earnings_call, press_release, clinical_trials, fda_approvals, faers, adcom, research_report"},
                "date_from": {"type": "string", "description": "Start date YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "End date YYYY-MM-DD"},
                "page": {"type": "integer", "description": "Page number for pagination (20 per page)"}
            }
        }
    })
}

pub fn fetch_document_outline_spec() -> Value {
    json!({
        "name": "fetch_document_outline",
        "description": "Get the table of contents (outline) for a specific document. Use AFTER fetch_filtered_document_names to identify which sections contain the data you need. Returns section headings with row_numbers for targeted page fetching.",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "source_id": {"type": "string", "description": "Document source ID from fetch_filtered_document_names"}
            },
            "required": ["source_id"]
        }
    })
}

pub fn fetch_document_chunk_content_spec() -> Value {
    json!({
        "name": "fetch_document_chunk_content",
        "description": "Fetch specific pages from a financial document by row numbers. Use AFTER fetch_document_outline to get targeted content. Returns page text with ref_id for citations. Format citations as [ref](ref_id-row_number).",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "source_id": {"type": "string", "description": "Document source ID"},
                "row_numbers": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Row numbers to fetch (from document outline)"
                }
            },
            "required": ["source_id", "row_numbers"]
        }
    })
}

pub fn search_keyword_in_source_spec() -> Value {
    json!({
        "name": "search_keyword_in_source",
        "description": "Full-text keyword search within a specific financial document. Use when you need to find specific terms or phrases. Returns matching snippets with row_numbers. Do NOT use as the first step — use fetch_document_outline first.",
        "category": "Financial",
        "permission": "ReadOnly",
        "input_schema": {
            "type": "object",
            "properties": {
                "source_id": {"type": "string", "description": "Document source ID"},
                "keyword": {"type": "string", "description": "Search term or phrase"},
                "page": {"type": "integer", "description": "Result page (20 per page)"}
            },
            "required": ["source_id", "keyword"]
        }
    })
}

pub fn fetch_filtered_document_names(client: &DataApiClient, input: &Value) -> Result<Value, String> {
    let params = ListSourcesParams {
        ticker: input["ticker"].as_str().map(String::from),
        year: input["year"].as_i64().map(|y| y as i32),
        date_from: input["date_from"].as_str().map(String::from),
        date_to: input["date_to"].as_str().map(String::from),
        page: input["page"].as_u64().map(|p| p as u32),
        ..Default::default()
    };
    match client.list_sources(&params) {
        Ok(sources) => Ok(json!(sources)),
        Err(e) => Err(format!("fetch_filtered_document_names error: {e}")),
    }
}

pub fn fetch_document_outline(client: &DataApiClient, input: &Value) -> Result<Value, String> {
    let source_id = input["source_id"].as_str().ok_or("missing source_id")?;
    match client.read_source_outline(source_id) {
        Ok(outline) => Ok(json!(outline)),
        Err(e) => Err(format!("fetch_document_outline error: {e}")),
    }
}

pub fn fetch_document_chunk_content(client: &DataApiClient, input: &Value) -> Result<Value, String> {
    let source_id = input["source_id"].as_str().ok_or("missing source_id")?;
    let row_numbers: Vec<u32> = input["row_numbers"]
        .as_array()
        .ok_or("missing row_numbers")?
        .iter()
        .filter_map(|v| v.as_u64().map(|n| n as u32))
        .collect();
    match client.read_source_pages(source_id, &row_numbers) {
        Ok(pages) => Ok(json!(pages)),
        Err(e) => Err(format!("fetch_document_chunk_content error: {e}")),
    }
}

pub fn search_keyword_in_source(client: &DataApiClient, input: &Value) -> Result<Value, String> {
    let source_id = input["source_id"].as_str().ok_or("missing source_id")?;
    let keyword = input["keyword"].as_str().ok_or("missing keyword")?;
    let page = input["page"].as_u64().map(|p| p as u32);
    match client.search_keyword_in_source(source_id, keyword, page) {
        Ok(results) => Ok(json!(results)),
        Err(e) => Err(format!("search_keyword_in_source error: {e}")),
    }
}

// T071: Unit tests for retrieval tool specs — verify name, description, schema.
#[cfg(test)]
mod tests {
    use super::*;

    fn spec_str<'a>(spec: &'a Value, key: &str) -> &'a str {
        spec[key].as_str().unwrap_or("")
    }

    #[test]
    fn fetch_filtered_document_names_spec_has_correct_name_and_description() {
        let spec = fetch_filtered_document_names_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_filtered_document_names");
        assert!(!spec_str(&spec, "description").is_empty());
        assert_eq!(spec_str(&spec, "category"), "Financial");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
    }

    #[test]
    fn fetch_filtered_document_names_spec_schema_has_optional_ticker_and_year() {
        let spec = fetch_filtered_document_names_spec();
        let props = &spec["input_schema"]["properties"];
        assert!(props["ticker"].is_object(), "ticker property missing");
        assert!(props["year"].is_object(), "year property missing");
        assert!(props["date_from"].is_object(), "date_from property missing");
        assert!(props["date_to"].is_object(), "date_to property missing");
        assert!(props["page"].is_object(), "page property missing");
        // No required fields — all optional
        assert!(spec["input_schema"]["required"].is_null() || spec["input_schema"]["required"].as_array().map(|a| a.is_empty()).unwrap_or(true));
    }

    #[test]
    fn fetch_document_outline_spec_has_correct_name_and_required_source_id() {
        let spec = fetch_document_outline_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_document_outline");
        assert!(!spec_str(&spec, "description").is_empty());
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("source_id".into())));
    }

    #[test]
    fn fetch_document_chunk_content_spec_requires_source_id_and_row_numbers() {
        let spec = fetch_document_chunk_content_spec();
        assert_eq!(spec_str(&spec, "name"), "fetch_document_chunk_content");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("source_id".into())));
        assert!(required.contains(&Value::String("row_numbers".into())));
        // row_numbers is an array of integers
        assert_eq!(spec["input_schema"]["properties"]["row_numbers"]["type"], "array");
        assert_eq!(spec["input_schema"]["properties"]["row_numbers"]["items"]["type"], "integer");
    }

    #[test]
    fn search_keyword_in_source_spec_requires_source_id_and_keyword() {
        let spec = search_keyword_in_source_spec();
        assert_eq!(spec_str(&spec, "name"), "search_keyword_in_source");
        assert_eq!(spec_str(&spec, "permission"), "ReadOnly");
        let required = spec["input_schema"]["required"].as_array().unwrap();
        assert!(required.contains(&Value::String("source_id".into())));
        assert!(required.contains(&Value::String("keyword".into())));
    }

    #[test]
    fn fetch_document_outline_missing_source_id_returns_error() {
        let client = agentii_data_api::DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({});
        let result = fetch_document_outline(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing source_id");
    }

    #[test]
    fn fetch_document_chunk_content_missing_source_id_returns_error() {
        let client = agentii_data_api::DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({});
        let result = fetch_document_chunk_content(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing source_id");
    }

    #[test]
    fn fetch_document_chunk_content_missing_row_numbers_returns_error() {
        let client = agentii_data_api::DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({ "source_id": "src-1" });
        let result = fetch_document_chunk_content(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing row_numbers");
    }

    #[test]
    fn search_keyword_in_source_missing_source_id_returns_error() {
        let client = agentii_data_api::DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({});
        let result = search_keyword_in_source(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing source_id");
    }

    #[test]
    fn search_keyword_in_source_missing_keyword_returns_error() {
        let client = agentii_data_api::DataApiClient::new("http://localhost:9999", None);
        let input = serde_json::json!({ "source_id": "src-1" });
        let result = search_keyword_in_source(&client, &input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "missing keyword");
    }
}
