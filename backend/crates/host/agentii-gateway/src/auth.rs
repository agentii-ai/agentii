use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

use agentii_protocol::gateway::ResponseFrame;

/// JWT claims extracted from a Supabase access token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Supabase user ID (UUID).
    pub sub: String,
    /// Token expiration (Unix timestamp).
    pub exp: u64,
    /// Issued-at (Unix timestamp).
    #[serde(default)]
    pub iat: u64,
    /// Audience.
    #[serde(default)]
    pub aud: Option<String>,
    /// Role (e.g. "authenticated").
    #[serde(default)]
    pub role: Option<String>,
    /// Email (optional, from Supabase JWT).
    #[serde(default)]
    pub email: Option<String>,
}

/// Auth error code returned in ResponseFrame on failure.
pub const AUTH_ERROR_CODE: &str = "-32001";

/// Configuration for JWT validation.
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// HMAC secret used to verify Supabase JWTs (the project's JWT secret).
    pub jwt_secret: String,
    /// If true, skip validation entirely (development mode).
    pub skip_validation: bool,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_secret: String::new(),
            skip_validation: false,
        }
    }
}

/// Shared auth state for the gateway.
#[derive(Clone)]
pub struct AuthState {
    config: Arc<AuthConfig>,
}

impl AuthState {
    pub fn new(config: AuthConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }

    /// Check if auth is in dev mode (validation skipped).
    pub fn is_dev_mode(&self) -> bool {
        self.config.skip_validation
    }

    /// Validate a bearer token and extract the user_id (sub claim).
    ///
    /// Returns `Ok(user_id)` on success, or an auth error `ResponseFrame` on failure.
    pub fn validate_token(&self, token: &str) -> Result<String, ResponseFrame> {
        if self.config.skip_validation {
            debug!("Auth validation skipped (dev mode)");
            // In dev mode, try to decode without verification to extract sub,
            // or fall back to a placeholder.
            return match decode_claims_unverified(token) {
                Some(claims) => Ok(claims.sub),
                None => Ok("dev-user".into()),
            };
        }

        if self.config.jwt_secret.is_empty() {
            warn!("JWT secret not configured — rejecting request");
            return Err(auth_error(
                "0",
                "JWT secret not configured on server",
            ));
        }

        let claims = verify_hs256(token, &self.config.jwt_secret).map_err(|msg| {
            warn!(error = %msg, "JWT validation failed");
            auth_error("0", &msg)
        })?;

        // Check expiration
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if claims.exp < now {
            warn!(exp = claims.exp, now, "JWT expired");
            return Err(auth_error("0", "Token expired"));
        }

        debug!(user_id = %claims.sub, "JWT validated");
        Ok(claims.sub)
    }
}

/// Extract user_id from a WebSocket upgrade request's query string or first message.
///
/// Looks for `?token=<jwt>` in the URI query.
pub fn extract_token_from_query(query: &str) -> Option<String> {
    for pair in query.split('&') {
        if let Some(value) = pair.strip_prefix("token=") {
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Extract bearer token from an Authorization header value.
pub fn extract_bearer_token(header_value: &str) -> Option<String> {
    header_value
        .strip_prefix("Bearer ")
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
}

/// Build an auth-failure ResponseFrame with error code -32001.
pub fn auth_error(request_id: &str, message: &str) -> ResponseFrame {
    ResponseFrame::error(request_id.to_string(), AUTH_ERROR_CODE, message)
}

// ---------------------------------------------------------------------------
// Minimal HMAC-SHA256 JWT verification (no heavy dependency)
// ---------------------------------------------------------------------------

/// Verify an HS256 JWT and return decoded claims.
fn verify_hs256(token: &str, secret: &str) -> Result<JwtClaims, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Malformed JWT: expected 3 parts".into());
    }

    let header_b64 = parts[0];
    let payload_b64 = parts[1];
    let signature_b64 = parts[2];

    // Verify signature: HMAC-SHA256(header.payload, secret)
    use sha2::Sha256;
    use hmac::{Hmac, Mac};

    type HmacSha256 = Hmac<Sha256>;

    let signing_input = format!("{}.{}", header_b64, payload_b64);
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| "Invalid HMAC key".to_string())?;
    mac.update(signing_input.as_bytes());

    let expected_sig = base64_url_decode(signature_b64)
        .map_err(|_| "Invalid base64 in signature".to_string())?;

    mac.verify_slice(&expected_sig)
        .map_err(|_| "Invalid JWT signature".to_string())?;

    // Decode payload
    let payload_bytes = base64_url_decode(payload_b64)
        .map_err(|_| "Invalid base64 in payload".to_string())?;

    serde_json::from_slice::<JwtClaims>(&payload_bytes)
        .map_err(|e| format!("Failed to parse JWT claims: {e}"))
}

/// Decode claims without verifying signature (for dev mode / token inspection).
fn decode_claims_unverified(token: &str) -> Option<JwtClaims> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let payload_bytes = base64_url_decode(parts[1]).ok()?;
    serde_json::from_slice::<JwtClaims>(&payload_bytes).ok()
}

/// Base64-URL decode (no padding required).
fn base64_url_decode(input: &str) -> Result<Vec<u8>, String> {
    // Add padding if needed
    let padded = match input.len() % 4 {
        2 => format!("{}==", input),
        3 => format!("{}=", input),
        _ => input.to_string(),
    };

    // Replace URL-safe chars with standard base64
    let standard = padded.replace('-', "+").replace('_', "/");

    // Use a simple base64 decoder
    base64_decode_standard(&standard)
}

/// Minimal standard base64 decoder.
fn base64_decode_standard(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    fn val(c: u8) -> Result<u8, String> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'a'..=b'z' => Ok(c - b'a' + 26),
            b'0'..=b'9' => Ok(c - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            b'=' => Ok(0),
            _ => Err(format!("Invalid base64 character: {}", c as char)),
        }
    }

    let bytes = input.as_bytes();
    if bytes.len() % 4 != 0 {
        return Err("Invalid base64 length".into());
    }

    let mut output = Vec::with_capacity(bytes.len() * 3 / 4);

    for chunk in bytes.chunks(4) {
        let a = val(chunk[0])?;
        let b = val(chunk[1])?;
        let c_val = val(chunk[2])?;
        let d = val(chunk[3])?;

        let triple = ((a as u32) << 18) | ((b as u32) << 12) | ((c_val as u32) << 6) | (d as u32);

        output.push((triple >> 16) as u8);
        if chunk[2] != b'=' {
            output.push((triple >> 8 & 0xFF) as u8);
        }
        if chunk[3] != b'=' {
            output.push((triple & 0xFF) as u8);
        }
    }

    let _ = TABLE; // suppress unused warning — TABLE documents the encoding
    Ok(output)
}

// ---------------------------------------------------------------------------
// HMAC implementation using sha2 (already a workspace dependency)
// ---------------------------------------------------------------------------

mod hmac {
    use sha2::{Digest, Sha256};

    const BLOCK_SIZE: usize = 64;

    pub type Hmac<D> = HmacImpl<D>;

    pub trait Mac: Sized {
        fn new_from_slice(key: &[u8]) -> Result<Self, &'static str>;
        fn update(&mut self, data: &[u8]);
        fn finalize(self) -> Vec<u8>;
        fn verify_slice(self, expected: &[u8]) -> Result<(), &'static str>;
    }

    pub struct HmacImpl<D> {
        _inner_key: Vec<u8>,
        outer_key: Vec<u8>,
        hasher: Sha256,
        _marker: std::marker::PhantomData<D>,
    }

    impl Mac for HmacImpl<Sha256> {
        fn new_from_slice(key: &[u8]) -> Result<Self, &'static str> {
            let actual_key = if key.len() > BLOCK_SIZE {
                let mut h = Sha256::new();
                h.update(key);
                h.finalize().to_vec()
            } else {
                key.to_vec()
            };

            let mut inner_key = vec![0x36u8; BLOCK_SIZE];
            let mut outer_key = vec![0x5cu8; BLOCK_SIZE];

            for (i, &b) in actual_key.iter().enumerate() {
                inner_key[i] ^= b;
                outer_key[i] ^= b;
            }

            let mut hasher = Sha256::new();
            hasher.update(&inner_key);

            Ok(Self {
                _inner_key: inner_key,
                outer_key,
                hasher,
                _marker: std::marker::PhantomData,
            })
        }

        fn update(&mut self, data: &[u8]) {
            self.hasher.update(data);
        }

        fn finalize(self) -> Vec<u8> {
            let inner_hash = self.hasher.finalize();
            let mut outer_hasher = Sha256::new();
            outer_hasher.update(&self.outer_key);
            outer_hasher.update(&inner_hash);
            outer_hasher.finalize().to_vec()
        }

        fn verify_slice(self, expected: &[u8]) -> Result<(), &'static str> {
            let result = self.finalize();
            if constant_time_eq(&result, expected) {
                Ok(())
            } else {
                Err("HMAC verification failed")
            }
        }
    }

    /// Constant-time comparison to prevent timing attacks.
    fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
        if a.len() != b.len() {
            return false;
        }
        let mut diff = 0u8;
        for (x, y) in a.iter().zip(b.iter()) {
            diff |= x ^ y;
        }
        diff == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_token_from_query() {
        assert_eq!(
            extract_token_from_query("token=abc123&foo=bar"),
            Some("abc123".into())
        );
        assert_eq!(extract_token_from_query("foo=bar"), None);
        assert_eq!(extract_token_from_query("token="), None);
    }

    #[test]
    fn test_extract_bearer_token() {
        assert_eq!(
            extract_bearer_token("Bearer eyJhbGciOi"),
            Some("eyJhbGciOi".into())
        );
        assert_eq!(extract_bearer_token("Basic abc"), None);
        assert_eq!(extract_bearer_token("Bearer "), None);
    }

    #[test]
    fn test_auth_error_response() {
        let resp = auth_error("req-1", "Unauthorized");
        assert!(!resp.ok);
        assert_eq!(resp.error.as_ref().unwrap().code, AUTH_ERROR_CODE);
    }

    #[test]
    fn test_dev_mode_skips_validation() {
        let state = AuthState::new(AuthConfig {
            jwt_secret: String::new(),
            skip_validation: true,
        });
        let result = state.validate_token("not-a-real-jwt");
        assert_eq!(result.unwrap(), "dev-user");
    }

    #[test]
    fn test_base64_url_decode() {
        // "hello" in base64url is "aGVsbG8"
        let decoded = base64_url_decode("aGVsbG8").unwrap();
        assert_eq!(decoded, b"hello");
    }
}
