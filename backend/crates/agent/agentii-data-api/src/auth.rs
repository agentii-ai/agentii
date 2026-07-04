//! X-API-Key authentication header injection.
use crate::DataApiClient;

impl DataApiClient {
    pub fn with_api_key(mut self, key: impl Into<String>) -> Self {
        self.api_key = Some(key.into());
        self
    }
}
