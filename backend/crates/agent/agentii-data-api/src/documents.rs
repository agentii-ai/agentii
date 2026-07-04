//! Document endpoints: search_documents, get_document_pages, get_document_outline.
use serde::{Deserialize, Serialize};
use crate::{DataApiClient, DataApiError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentOutline {
    pub doc_id: String,
    pub title: String,
    pub sections: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentPage {
    pub page_num: u32,
    pub content: String,
}

impl DataApiClient {
    pub fn search_documents(&self, query: &str, ticker: Option<&str>) -> Result<Vec<crate::agentic_retrieval::SourceSummary>, DataApiError> {
        let mut req = self.get("/v1/documents/search").query(&[("q", query)]);
        if let Some(t) = ticker { req = req.query(&[("ticker", t)]); }
        let resp = req.send()?;
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json().map_err(|e| DataApiError::ParseError(e.to_string()))
    }

    pub fn get_document_pages(&self, doc_id: &str, pages: &[u32]) -> Result<Vec<DocumentPage>, DataApiError> {
        let rows: Vec<String> = pages.iter().map(|n| n.to_string()).collect();
        let resp = self.get(&format!("/v1/documents/{doc_id}/pages"))
            .query(&[("pages", rows.join(","))]).send()?;
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json().map_err(|e| DataApiError::ParseError(e.to_string()))
    }

    pub fn get_document_outline(&self, doc_id: &str) -> Result<DocumentOutline, DataApiError> {
        let resp = self.get(&format!("/v1/documents/{doc_id}/outline")).send()?;
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json().map_err(|e| DataApiError::ParseError(e.to_string()))
    }
}
