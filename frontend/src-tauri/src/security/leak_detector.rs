use std::sync::OnceLock;

/// Compiled redaction patterns cached for reuse across calls.
struct RedactionPattern {
    regex: regex_lite::Regex,
    replacement: &'static str,
}

/// Lazily compiled redaction patterns — built once, reused forever.
fn patterns() -> &'static [RedactionPattern] {
    static PATTERNS: OnceLock<Vec<RedactionPattern>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        let defs: &[(&str, &str)] = &[
            // Bearer tokens (JWT, OAuth)
            (r"Bearer [A-Za-z0-9\-._~+/]+=*", "[REDACTED_BEARER_TOKEN]"),
            // AWS access key IDs
            (r"AKIA[0-9A-Z]{16}", "[REDACTED_AWS_KEY]"),
            // AWS secret keys (40-char base64 after common prefixes)
            (
                r#"(?i)(aws_secret_access_key|aws_secret)[=: ]+['"]?[A-Za-z0-9/+=]{40}['"]?"#,
                "[REDACTED_AWS_SECRET]",
            ),
            // Anthropic API keys — MUST come before generic sk- pattern
            (r"sk-ant-[A-Za-z0-9\-]{20,}", "[REDACTED_ANTHROPIC_KEY]"),
            // sk- prefixed keys (OpenAI, Stripe, etc.)
            (r"sk-[A-Za-z0-9]{20,}", "[REDACTED_SK_KEY]"),
            // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
            (r"gh[pousr]_[A-Za-z0-9]{36,}", "[REDACTED_GH_TOKEN]"),
            // Slack tokens (xoxb-, xoxp-, xoxa-, xoxo-, xoxr-, xoxs-) — MUST come before generic credential
            (r"xox[bporas]-[A-Za-z0-9\-]+", "[REDACTED_SLACK_TOKEN]"),
            // Generic API keys / secrets / tokens / passwords after common prefixes
            (
                r#"(?i)(api[_-]?key|api[_-]?secret|token|password|secret|credential)[=: ]+['"]?[A-Za-z0-9\-._~+/]{20,}['"]?"#,
                "[REDACTED_CREDENTIAL]",
            ),
            // Private keys (PEM header)
            (
                r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
                "[REDACTED_PRIVATE_KEY]",
            ),
            // Slack tokens (xoxb-, xoxp-, xoxa-, xoxo-, xoxr-, xoxs-)
            (r"xox[bporas]-[A-Za-z0-9\-]+", "[REDACTED_SLACK_TOKEN]"),
        ];

        defs.iter()
            .filter_map(|(pat, repl)| {
                regex_lite::Regex::new(pat)
                    .ok()
                    .map(|regex| RedactionPattern {
                        regex,
                        replacement: repl,
                    })
            })
            .collect()
    })
}

/// Redact sensitive credentials from text content.
///
/// Replaces common API key, token, and credential patterns with `[REDACTED_*]`
/// placeholders. Safe to call on any text — non-matching content passes through
/// unchanged.
///
/// Used by:
/// - Session capture (PTY buffer redaction before LLM calls)
/// - Fallback session file writing
/// - Any future path that handles untrusted terminal output
pub fn redact_secrets(input: &str) -> String {
    let mut result = input.to_string();
    for p in patterns() {
        result = p.regex.replace_all(&result, p.replacement).to_string();
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_sk_key() {
        let input = "Using key sk-abc123def456ghi789jkl012mno345pqr678";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_SK_KEY]"));
        assert!(!redacted.contains("sk-abc123"));
    }

    #[test]
    fn test_redact_bearer_token() {
        let input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_BEARER_TOKEN]"));
    }

    #[test]
    fn test_redact_aws_key() {
        let input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_AWS_KEY]"));
    }

    #[test]
    fn test_redact_github_token() {
        let input = "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop";
        let redacted = redact_secrets(input);
        assert!(
            redacted.contains("[REDACTED_GH_TOKEN]") || redacted.contains("[REDACTED_CREDENTIAL]"),
            "Expected redaction, got: {}",
            redacted
        );
    }

    #[test]
    fn test_redact_generic_credential() {
        let input = r#"api_key="abcdefghijklmnopqrstuvwxyz1234""#;
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_CREDENTIAL]"));
    }

    #[test]
    fn test_redact_private_key_header() {
        let input = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_PRIVATE_KEY]"));
    }

    #[test]
    fn test_redact_slack_token() {
        let input = "SLACK_TOKEN=xoxb-1234567890-abcdefghij";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_SLACK_TOKEN]"));
    }

    #[test]
    fn test_redact_anthropic_key() {
        let input = "ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_ANTHROPIC_KEY]"));
    }

    #[test]
    fn test_passthrough_clean_text() {
        let input = "This is normal text with no secrets at all.";
        let redacted = redact_secrets(input);
        assert_eq!(input, redacted);
    }

    #[test]
    fn test_multiple_secrets_in_one_string() {
        let input = "key=sk-abc123def456ghi789jkl012mno345pqr678 and Bearer eyJhbGciOiJIUzI1NiJ9.test";
        let redacted = redact_secrets(input);
        assert!(redacted.contains("[REDACTED_SK_KEY]"));
        assert!(redacted.contains("[REDACTED_BEARER_TOKEN]"));
        assert!(!redacted.contains("sk-abc123"));
    }
}
