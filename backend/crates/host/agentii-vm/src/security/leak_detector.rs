//! Credential leak detection for PTY output streams.
//! Scans agent output for known API key patterns and redacts them.

use regex::RegexSet;
use std::sync::OnceLock;

/// Compiled regex patterns for credential detection.
static PATTERNS: OnceLock<RegexSet> = OnceLock::new();

/// Cached individual Regex objects for replacement (avoids recompilation per call).
static REPLACEMENT_REGEXES: OnceLock<Vec<(regex::Regex, &'static str)>> = OnceLock::new();

/// Pattern definitions shared between RegexSet and individual Regex cache.
const PATTERN_DEFS: &[(&str, &str)] = &[
    (r"sk-ant-[a-zA-Z0-9_-]{20,}", "[REDACTED:anthropic-key]"),
    (r"sk-[a-zA-Z0-9]{20,}", "[REDACTED:api-key]"),
    (r"AKIA[0-9A-Z]{16}", "[REDACTED:aws-key]"),
    (r"ghp_[a-zA-Z0-9]{36,}", "[REDACTED:github-token]"),
    (r"gho_[a-zA-Z0-9]{36,}", "[REDACTED:github-token]"),
    (r"ghs_[a-zA-Z0-9]{36,}", "[REDACTED:github-token]"),
    (r"ghr_[a-zA-Z0-9]{36,}", "[REDACTED:github-token]"),
    (r"AIza[0-9A-Za-z_-]{35}", "[REDACTED:google-key]"),
    (r"Bearer\s+[a-zA-Z0-9_-]{20,}", "Bearer [REDACTED]"),
];

/// Get or initialize the credential pattern matcher.
fn patterns() -> &'static RegexSet {
    PATTERNS.get_or_init(|| {
        let pats: Vec<&str> = PATTERN_DEFS.iter().map(|(p, _)| *p).collect();
        RegexSet::new(pats).expect("Invalid regex patterns")
    })
}

/// Get or initialize the cached individual Regex objects for replacement.
fn replacement_regexes() -> &'static Vec<(regex::Regex, &'static str)> {
    REPLACEMENT_REGEXES.get_or_init(|| {
        PATTERN_DEFS
            .iter()
            .map(|(pat, repl)| (regex::Regex::new(pat).unwrap(), *repl))
            .collect()
    })
}

/// Fast boolean check: does the text contain any credential pattern?
/// Uses RegexSet::is_match() — no allocations, no replacements.
pub fn contains_credential_pattern(text: &str) -> bool {
    patterns().is_match(text)
}

/// Scan text for credential patterns and replace matches with [REDACTED].
///
/// Uses RegexSet for efficient multi-pattern matching in a single pass.
/// Returns the sanitized text.
pub fn scan_output(text: &str) -> String {
    let pat = patterns();
    if !pat.is_match(text) {
        return text.to_string();
    }

    // Use cached compiled regexes for replacement (no recompilation)
    let mut result = text.to_string();
    for (re, replacement) in replacement_regexes() {
        result = re.replace_all(&result, *replacement).to_string();
    }

    result
}

/// Scan text for base64-encoded credentials.
///
/// Finds base64 chunks ≥40 chars, decodes them, and checks the decoded content
/// against credential patterns. Returns sanitized text with encoded credentials
/// replaced by [REDACTED:encoded-credential].
pub fn scan_base64_encoded(text: &str) -> String {
    static B64_RE: OnceLock<regex::Regex> = OnceLock::new();
    // Require ≥60 chars to reduce false positives (UUIDs are 36 chars, most
    // variable names are shorter). Also require at least one uppercase AND one
    // lowercase letter — pure hex or pure-upper strings are unlikely base64 creds.
    let b64_re = B64_RE.get_or_init(|| {
        regex::Regex::new(r"[A-Za-z0-9+/=_-]{60,}").expect("Invalid base64 regex")
    });

    let pat = patterns();
    let mut result = text.to_string();
    let mut replacements: Vec<(std::ops::Range<usize>, &str)> = Vec::new();

    for m in b64_re.find_iter(text) {
        let chunk = m.as_str();
        // Structural pre-filter: must contain both upper and lower alpha chars
        // to look like real base64 (not a hex string or path component).
        let has_upper = chunk.bytes().any(|b| b.is_ascii_uppercase());
        let has_lower = chunk.bytes().any(|b| b.is_ascii_lowercase());
        if !has_upper || !has_lower {
            continue;
        }
        // Try standard base64 decode
        if let Some(decoded) = try_base64_decode(chunk) {
            if let Ok(decoded_str) = std::str::from_utf8(&decoded) {
                if pat.is_match(decoded_str) {
                    replacements.push((m.range(), "[REDACTED:encoded-credential]"));
                }
            }
        }
    }

    // Apply replacements in reverse order to preserve indices
    for (range, replacement) in replacements.into_iter().rev() {
        result.replace_range(range, replacement);
    }

    result
}

/// Scan output for both raw and base64-encoded credentials.
/// This is the full two-pass scan used for PTY output.
pub fn scan_output_full(text: &str) -> String {
    let pass1 = scan_output(text);
    scan_base64_encoded(&pass1)
}

/// Try to decode a base64 or base64url string. Returns None on failure.
fn try_base64_decode(input: &str) -> Option<Vec<u8>> {
    // Normalize base64url to standard base64
    let standard: String = input.chars().map(|c| match c {
        '-' => '+',
        '_' => '/',
        other => other,
    }).collect();

    // Add padding if needed
    let padded = match standard.len() % 4 {
        2 => format!("{}==", standard),
        3 => format!("{}=", standard),
        _ => standard,
    };

    base64_decode_bytes(&padded)
}

/// Minimal base64 decoder (no external dependency).
fn base64_decode_bytes(input: &str) -> Option<Vec<u8>> {
    fn val(c: u8) -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            b'=' => Some(0),
            _ => None,
        }
    }

    let bytes = input.as_bytes();
    if bytes.len() % 4 != 0 {
        return None;
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

    Some(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_secrets_unchanged() {
        let text = "Hello world, this is normal output";
        assert_eq!(scan_output(text), text);
    }

    #[test]
    fn test_anthropic_key_redacted() {
        let text = "Using key sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456";
        let result = scan_output(text);
        assert!(result.contains("[REDACTED"));
        assert!(!result.contains("sk-ant-api03"));
    }

    #[test]
    fn test_openai_key_redacted() {
        let text = "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz12345678";
        let result = scan_output(text);
        assert!(result.contains("[REDACTED"));
        assert!(!result.contains("sk-abcdefghijklmnopqrstuvwxyz"));
    }

    #[test]
    fn test_aws_key_redacted() {
        let text = "aws_access_key_id = AKIAIOSFODNN7EXAMPLE";
        let result = scan_output(text);
        assert!(result.contains("[REDACTED"));
        assert!(!result.contains("AKIAIOSFODNN7EXAMPLE"));
    }

    #[test]
    fn test_github_token_redacted() {
        let text = "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn";
        let result = scan_output(text);
        assert!(result.contains("[REDACTED"));
        assert!(!result.contains("ghp_ABCDEF"));
    }

    #[test]
    fn test_multiple_secrets_redacted() {
        let text = "key1=sk-ant-api03-abcdefghijklmnopqrstuvwxyz key2=AKIAIOSFODNN7EXAMPLE";
        let result = scan_output(text);
        assert!(!result.contains("sk-ant-api03"));
        assert!(!result.contains("AKIAIOSFODNN7EXAMPLE"));
    }

    #[test]
    fn test_contains_credential_pattern_fast() {
        assert!(contains_credential_pattern("sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456"));
        assert!(contains_credential_pattern("AKIAIOSFODNN7EXAMPLE"));
        assert!(!contains_credential_pattern("hello world normal text"));
    }

    #[test]
    fn test_scan_output_full_raw_and_encoded() {
        // Raw credential should be caught
        let text = "key=sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456";
        let result = scan_output_full(text);
        assert!(result.contains("[REDACTED"));
        assert!(!result.contains("sk-ant-api03"));
    }

    #[test]
    fn test_base64_decode_roundtrip() {
        let decoded = try_base64_decode("aGVsbG8gd29ybGQ=").unwrap();
        assert_eq!(decoded, b"hello world");
    }
}
