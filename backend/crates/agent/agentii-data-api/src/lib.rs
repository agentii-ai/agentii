//! HTTP client for agentii.ai agent-use-ready data APIs.
//! Dev: local Supabase (port 54322). Prod: Neon serverless PostgreSQL.

pub mod agentic_retrieval;
pub mod auth;
pub mod companies;
pub mod documents;

pub use agentic_retrieval::{
    KeywordSearchResult, ListSourcesParams, SourceOutline, SourcePages, SourceType,
};
pub use companies::CompanyProfile;
pub use documents::{DocumentOutline, DocumentPage};

use std::time::{Duration, Instant};

use reqwest::blocking::{Client, Response};
use thiserror::Error;

// ---------------------------------------------------------------------------
// T100: Structured error enum
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum DataApiError {
    #[error("authentication error: {0}")]
    AuthError(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("rate limited")]
    RateLimited,
    #[error("server error: {0}")]
    ServerError(String),
    #[error("network error: {0}")]
    NetworkError(#[from] reqwest::Error),
    #[error("parse error: {0}")]
    ParseError(String),
}

// ---------------------------------------------------------------------------
// T098: Token-bucket rate limiter
// ---------------------------------------------------------------------------

/// Simple token-bucket rate limiter (single-threaded / blocking client).
#[derive(Debug, Clone)]
pub struct RateLimiter {
    /// Maximum tokens in the bucket.
    capacity: f64,
    /// Current available tokens.
    tokens: f64,
    /// Tokens added per second.
    refill_rate: f64,
    /// Last time the bucket was refilled.
    last_refill: Instant,
}

impl RateLimiter {
    /// Create a new limiter with `capacity` tokens and `refill_rate` tokens/sec.
    #[must_use]
    pub fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            capacity,
            tokens: capacity,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    /// Refill tokens based on elapsed time, then attempt to consume one token.
    /// Returns `true` if a token was available.
    pub fn try_acquire(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

// ---------------------------------------------------------------------------
// T099: Env-based URL resolution
// ---------------------------------------------------------------------------

/// Resolve the base URL from environment variables.
///
/// - `AGENTII_DATA_ENV=production` → `AGENTII_NEON_DATABASE_URL` or `https://api.agentii.ai`
/// - `AGENTII_DATA_ENV=development` (default) → `http://localhost:54322`
fn resolve_base_url() -> String {
    let env = std::env::var("AGENTII_DATA_ENV").unwrap_or_else(|_| "development".to_string());
    match env.as_str() {
        "production" => std::env::var("AGENTII_NEON_DATABASE_URL")
            .or_else(|_| std::env::var("AGENTII_DATA_BASE_URL"))
            .unwrap_or_else(|_| "https://api.agentii.ai".to_string()),
        _ => std::env::var("AGENTII_DATA_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:54322".to_string()),
    }
}

// ---------------------------------------------------------------------------
// DataApiClient
// ---------------------------------------------------------------------------

/// HTTP client for the agentii.ai data API.
#[derive(Clone)]
pub struct DataApiClient {
    pub base_url: String,
    pub api_key: Option<String>,
    client: Client,
}

impl DataApiClient {
    /// Create from environment variables.
    /// Env-based URL switching (T099):
    ///   - `AGENTII_DATA_ENV=production` → Neon / `https://api.agentii.ai`
    ///   - default → `http://localhost:54322` (local Supabase)
    pub fn from_env() -> Self {
        let base_url = resolve_base_url();
        let api_key = std::env::var("AGENTII_API_KEY").ok();
        Self {
            base_url,
            api_key,
            client: Client::new(),
        }
    }

    pub fn new(base_url: impl Into<String>, api_key: Option<String>) -> Self {
        Self {
            base_url: base_url.into(),
            api_key,
            client: Client::new(),
        }
    }

    pub fn get(&self, path: &str) -> reqwest::blocking::RequestBuilder {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.client.get(&url);
        if let Some(key) = &self.api_key {
            req = req.header("X-API-Key", key);
        }
        req
    }

    // -----------------------------------------------------------------------
    // T097: Retry with exponential backoff on 429 / 5xx
    // -----------------------------------------------------------------------

    /// Execute a request builder, retrying on 429 or 5xx responses.
    ///
    /// Retries up to 3 times with delays of 1 s, 2 s, 4 s (exponential backoff).
    /// Returns the final `Response` on success, or a `DataApiError` after all
    /// retries are exhausted.
    pub fn retry_request(
        &self,
        build: impl Fn() -> reqwest::blocking::RequestBuilder,
    ) -> Result<Response, DataApiError> {
        const MAX_RETRIES: u32 = 3;
        let delays = [1u64, 2, 4];

        let mut last_err: Option<DataApiError> = None;

        for attempt in 0..=MAX_RETRIES {
            match build().send() {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        return Ok(resp);
                    }
                    if status == 429 {
                        last_err = Some(DataApiError::RateLimited);
                    } else if status.is_server_error() {
                        last_err = Some(DataApiError::ServerError(status.to_string()));
                    } else if status == 401 || status == 403 {
                        return Err(DataApiError::AuthError(status.to_string()));
                    } else if status == 404 {
                        return Err(DataApiError::NotFound(status.to_string()));
                    } else {
                        return Err(DataApiError::ServerError(status.to_string()));
                    }
                }
                Err(e) => {
                    last_err = Some(DataApiError::NetworkError(e));
                }
            }

            if attempt < MAX_RETRIES {
                std::thread::sleep(Duration::from_secs(delays[attempt as usize]));
            }
        }

        Err(last_err.unwrap_or_else(|| DataApiError::ServerError("unknown".into())))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serialize env-var tests to prevent races between parallel test threads.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    // --- RateLimiter tests ---

    #[test]
    fn rate_limiter_acquires_up_to_capacity() {
        let mut rl = RateLimiter::new(3.0, 1.0);
        assert!(rl.try_acquire(), "first token");
        assert!(rl.try_acquire(), "second token");
        assert!(rl.try_acquire(), "third token");
        assert!(!rl.try_acquire(), "bucket empty");
    }

    #[test]
    fn rate_limiter_refills_over_time() {
        let mut rl = RateLimiter::new(1.0, 100.0); // 100 tokens/sec
        assert!(rl.try_acquire());
        assert!(!rl.try_acquire());
        // Simulate time passing by manipulating last_refill
        rl.last_refill = Instant::now() - Duration::from_millis(20);
        // After 20ms at 100 tok/s → 2 tokens added, capped at 1
        assert!(rl.try_acquire());
    }

    // --- resolve_base_url tests ---

    #[test]
    fn default_env_resolves_to_local_supabase() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::remove_var("AGENTII_DATA_ENV");
        std::env::remove_var("AGENTII_DATA_BASE_URL");
        std::env::remove_var("AGENTII_NEON_DATABASE_URL");
        let url = resolve_base_url();
        assert_eq!(url, "http://localhost:54322");
    }

    #[test]
    fn development_env_resolves_to_local_supabase() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("AGENTII_DATA_ENV", "development");
        std::env::remove_var("AGENTII_DATA_BASE_URL");
        std::env::remove_var("AGENTII_NEON_DATABASE_URL");
        let url = resolve_base_url();
        std::env::remove_var("AGENTII_DATA_ENV");
        assert_eq!(url, "http://localhost:54322");
    }

    #[test]
    fn production_env_resolves_to_api_agentii() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("AGENTII_DATA_ENV", "production");
        std::env::remove_var("AGENTII_NEON_DATABASE_URL");
        std::env::remove_var("AGENTII_DATA_BASE_URL");
        let url = resolve_base_url();
        std::env::remove_var("AGENTII_DATA_ENV");
        assert_eq!(url, "https://api.agentii.ai");
    }

    #[test]
    fn production_env_uses_neon_url_when_set() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("AGENTII_DATA_ENV", "production");
        std::env::set_var("AGENTII_NEON_DATABASE_URL", "https://neon.example.com");
        std::env::remove_var("AGENTII_DATA_BASE_URL");
        let url = resolve_base_url();
        std::env::remove_var("AGENTII_DATA_ENV");
        std::env::remove_var("AGENTII_NEON_DATABASE_URL");
        assert_eq!(url, "https://neon.example.com");
    }

    // --- DataApiError display tests ---

    #[test]
    fn data_api_error_display() {
        assert_eq!(
            DataApiError::AuthError("401".into()).to_string(),
            "authentication error: 401"
        );
        assert_eq!(DataApiError::RateLimited.to_string(), "rate limited");
        assert_eq!(
            DataApiError::NotFound("doc".into()).to_string(),
            "not found: doc"
        );
        assert_eq!(
            DataApiError::ServerError("500".into()).to_string(),
            "server error: 500"
        );
        assert_eq!(
            DataApiError::ParseError("bad json".into()).to_string(),
            "parse error: bad json"
        );
    }
}
