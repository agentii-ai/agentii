//! T112: Provider chain with circuit breakers and failover.
//!
//! `ProviderChain` wraps a list of `ProviderClient` instances and tries them
//! in order. Each provider has an independent `CircuitBreaker` that opens
//! after `failure_threshold` consecutive failures and stays open for
//! `reset_timeout` before allowing a probe request through.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::client::{MessageStream, ProviderClient};
use crate::error::ApiError;
use crate::types::{MessageRequest, MessageResponse};

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug)]
struct CircuitBreaker {
    state: CircuitState,
    failures: u32,
    failure_threshold: u32,
    reset_timeout: Duration,
    opened_at: Option<Instant>,
}

impl CircuitBreaker {
    fn new(failure_threshold: u32, reset_timeout: Duration) -> Self {
        Self {
            state: CircuitState::Closed,
            failures: 0,
            failure_threshold,
            reset_timeout,
            opened_at: None,
        }
    }

    /// Returns `true` if a request should be allowed through.
    fn allow_request(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if let Some(opened_at) = self.opened_at {
                    if opened_at.elapsed() >= self.reset_timeout {
                        self.state = CircuitState::HalfOpen;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    fn record_success(&mut self) {
        self.failures = 0;
        self.state = CircuitState::Closed;
        self.opened_at = None;
    }

    fn record_failure(&mut self) {
        self.failures += 1;
        if self.state == CircuitState::HalfOpen || self.failures >= self.failure_threshold {
            self.state = CircuitState::Open;
            self.opened_at = Some(Instant::now());
        }
    }

    fn is_open(&self) -> bool {
        self.state == CircuitState::Open
    }
}

// ---------------------------------------------------------------------------
// ProviderChain
// ---------------------------------------------------------------------------

struct ChainEntry {
    client: ProviderClient,
    breaker: CircuitBreaker,
}

/// A chain of `ProviderClient` instances with per-provider circuit breakers.
///
/// On each request the chain iterates providers in order, skipping any whose
/// circuit breaker is open. The first successful response is returned. If all
/// providers fail or are open, the last error is returned.
pub struct ProviderChain {
    entries: Arc<Mutex<Vec<ChainEntry>>>,
}

impl ProviderChain {
    /// Create a chain from a list of clients.
    ///
    /// Each provider gets a circuit breaker that opens after
    /// `failure_threshold` consecutive failures and resets after
    /// `reset_timeout`.
    pub fn new(
        clients: Vec<ProviderClient>,
        failure_threshold: u32,
        reset_timeout: Duration,
    ) -> Self {
        let entries = clients
            .into_iter()
            .map(|client| ChainEntry {
                client,
                breaker: CircuitBreaker::new(failure_threshold, reset_timeout),
            })
            .collect();
        Self {
            entries: Arc::new(Mutex::new(entries)),
        }
    }

    /// Send a message, trying each provider in order.
    pub async fn send_message(
        &self,
        request: &MessageRequest,
    ) -> Result<MessageResponse, ApiError> {
        let mut last_err: Option<ApiError> = None;

        let count = self.entries.lock().unwrap().len();
        for i in 0..count {
            let allowed = {
                let mut entries = self.entries.lock().unwrap();
                entries[i].breaker.allow_request()
            };
            if !allowed {
                continue;
            }

            let client = {
                let entries = self.entries.lock().unwrap();
                entries[i].client.clone()
            };

            match client.send_message(request).await {
                Ok(resp) => {
                    self.entries.lock().unwrap()[i].breaker.record_success();
                    return Ok(resp);
                }
                Err(e) => {
                    self.entries.lock().unwrap()[i].breaker.record_failure();
                    last_err = Some(e);
                }
            }
        }

        Err(last_err.unwrap_or_else(|| {
            ApiError::Api {
                status: reqwest::StatusCode::SERVICE_UNAVAILABLE,
                error_type: Some("provider_chain_exhausted".into()),
                message: Some("all providers in chain are unavailable".into()),
                request_id: None,
                body: String::new(),
                retryable: false,
                suggested_action: None,
            }
        }))
    }

    /// Stream a message, trying each provider in order.
    pub async fn stream_message(
        &self,
        request: &MessageRequest,
    ) -> Result<MessageStream, ApiError> {
        let mut last_err: Option<ApiError> = None;

        let count = self.entries.lock().unwrap().len();
        for i in 0..count {
            let allowed = {
                let mut entries = self.entries.lock().unwrap();
                entries[i].breaker.allow_request()
            };
            if !allowed {
                continue;
            }

            let client = {
                let entries = self.entries.lock().unwrap();
                entries[i].client.clone()
            };

            match client.stream_message(request).await {
                Ok(stream) => {
                    self.entries.lock().unwrap()[i].breaker.record_success();
                    return Ok(stream);
                }
                Err(e) => {
                    self.entries.lock().unwrap()[i].breaker.record_failure();
                    last_err = Some(e);
                }
            }
        }

        Err(last_err.unwrap_or_else(|| {
            ApiError::Api {
                status: reqwest::StatusCode::SERVICE_UNAVAILABLE,
                error_type: Some("provider_chain_exhausted".into()),
                message: Some("all providers in chain are unavailable".into()),
                request_id: None,
                body: String::new(),
                retryable: false,
                suggested_action: None,
            }
        }))
    }

    /// Returns the number of providers with open circuit breakers.
    pub fn open_circuit_count(&self) -> usize {
        self.entries
            .lock()
            .unwrap()
            .iter()
            .filter(|e| e.breaker.is_open())
            .count()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn circuit_breaker_opens_after_threshold() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(60));
        assert!(cb.allow_request());
        cb.record_failure();
        cb.record_failure();
        assert!(cb.allow_request()); // still closed
        cb.record_failure();
        assert!(!cb.allow_request()); // now open
    }

    #[test]
    fn circuit_breaker_resets_after_timeout() {
        let mut cb = CircuitBreaker::new(1, Duration::from_millis(10));
        cb.record_failure();
        assert!(!cb.allow_request());
        std::thread::sleep(Duration::from_millis(15));
        assert!(cb.allow_request()); // half-open
        cb.record_success();
        assert!(cb.allow_request()); // closed again
    }

    #[test]
    fn circuit_breaker_half_open_failure_reopens() {
        let mut cb = CircuitBreaker::new(1, Duration::from_millis(10));
        cb.record_failure();
        std::thread::sleep(Duration::from_millis(15));
        assert!(cb.allow_request()); // half-open
        cb.record_failure(); // probe failed → reopen
        assert!(!cb.allow_request());
    }

    #[test]
    fn circuit_breaker_success_resets_failures() {
        let mut cb = CircuitBreaker::new(3, Duration::from_secs(60));
        cb.record_failure();
        cb.record_failure();
        cb.record_success();
        // failures reset — need 3 more to open
        cb.record_failure();
        cb.record_failure();
        assert!(cb.allow_request()); // still closed
    }
}
