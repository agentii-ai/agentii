//! Agentic retrieval endpoints: list_sources, read_source_outline, read_source_pages, search_keyword_in_source.
use serde::{Deserialize, Serialize};
use crate::{DataApiClient, DataApiError};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    Sec10k,
    Sec10q,
    Sec8k,
    Sec13f,
    Edgar,
    ClinicalTrials,
    FdaApprovals,
    Faers,
    Adcom,
    EarningsCall,
    PressRelease,
    ResearchReport,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ListSourcesParams {
    pub ticker: Option<String>,
    pub year: Option<i32>,
    pub source_type: Option<SourceType>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceSummary {
    pub source_id: String,
    pub ref_id: String,
    pub ticker: Option<String>,
    pub source_type: SourceType,
    pub title: String,
    pub date: Option<String>,
    pub description: Option<String>,
    pub page_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceOutline {
    pub source_id: String,
    pub title: String,
    pub outline: Vec<OutlineEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutlineEntry {
    pub row_number: u32,
    pub heading: String,
    pub level: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourcePages {
    pub source_id: String,
    pub pages: Vec<PageContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageContent {
    pub row_number: u32,
    pub content: String,
    pub ref_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeywordSearchResult {
    pub source_id: String,
    pub ref_id: String,
    pub row_number: u32,
    pub snippet: String,
    pub score: f32,
}

impl DataApiClient {
    pub fn list_sources(&self, params: &ListSourcesParams) -> Result<Vec<SourceSummary>, DataApiError> {
        let mut req = self.get("/v1/sources");
        if let Some(ticker) = &params.ticker {
            req = req.query(&[("ticker", ticker.as_str())]);
        }
        if let Some(year) = params.year {
            req = req.query(&[("year", year.to_string())]);
        }
        if let Some(page) = params.page {
            req = req.query(&[("page", page.to_string())]);
        }
        let resp = req.send()?;
        if resp.status() == 404 { return Ok(vec![]); }
        if resp.status() == 429 { return Err(DataApiError::RateLimited); }
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json::<Vec<SourceSummary>>().map_err(|e| DataApiError::ParseError(e.to_string()))
    }

    pub fn read_source_outline(&self, source_id: &str) -> Result<SourceOutline, DataApiError> {
        let resp = self.get(&format!("/v1/sources/{source_id}/outline")).send()?;
        if resp.status() == 404 { return Err(DataApiError::NotFound(source_id.to_string())); }
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json::<SourceOutline>().map_err(|e| DataApiError::ParseError(e.to_string()))
    }

    pub fn read_source_pages(&self, source_id: &str, row_numbers: &[u32]) -> Result<SourcePages, DataApiError> {
        let rows: Vec<String> = row_numbers.iter().map(|n| n.to_string()).collect();
        let resp = self.get(&format!("/v1/sources/{source_id}/pages"))
            .query(&[("rows", rows.join(","))])
            .send()?;
        if resp.status() == 404 { return Err(DataApiError::NotFound(source_id.to_string())); }
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json::<SourcePages>().map_err(|e| DataApiError::ParseError(e.to_string()))
    }

    pub fn search_keyword_in_source(
        &self,
        source_id: &str,
        keyword: &str,
        page: Option<u32>,
    ) -> Result<Vec<KeywordSearchResult>, DataApiError> {
        let mut req = self.get(&format!("/v1/sources/{source_id}/search"))
            .query(&[("q", keyword)]);
        if let Some(p) = page {
            req = req.query(&[("page", p.to_string())]);
        }
        let resp = req.send()?;
        if resp.status() == 404 { return Ok(vec![]); }
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json::<Vec<KeywordSearchResult>>().map_err(|e| DataApiError::ParseError(e.to_string()))
    }
}
