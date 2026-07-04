//! Company profile endpoint.
use serde::{Deserialize, Serialize};
use crate::{DataApiClient, DataApiError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyProfile {
    pub ticker: String,
    pub name: String,
    pub sector: Option<String>,
    pub industry: Option<String>,
    pub market_cap: Option<f64>,
    pub description: Option<String>,
    pub exchange: Option<String>,
    pub currency: Option<String>,
}

impl DataApiClient {
    pub fn get_company_profile(&self, ticker: &str) -> Result<CompanyProfile, DataApiError> {
        let resp = self.get(&format!("/v1/companies/{ticker}")).send()?;
        if resp.status() == 404 {
            return Err(DataApiError::NotFound(ticker.to_string()));
        }
        if !resp.status().is_success() {
            return Err(DataApiError::ServerError(resp.status().to_string()));
        }
        resp.json::<CompanyProfile>().map_err(|e| DataApiError::ParseError(e.to_string()))
    }
}
