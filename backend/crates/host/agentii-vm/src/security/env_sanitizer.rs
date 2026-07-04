//! Environment variable sanitization for VM subprocess spawning.
//! Implements env_clear() + safe var allowlist pattern from ZeroClaw.

use std::collections::HashMap;

/// Environment variables that are safe to pass through to VM subprocesses.
const SAFE_VARS: &[&str] = &[
    "PATH", "HOME", "TERM", "LANG", "LC_ALL", "USER", "SHELL",
    "LOGNAME", "HOSTNAME", "PWD", "TMPDIR", "TZ",
];

/// Patterns in env var names that indicate sensitive credentials.
/// Any var matching these patterns is blocked unless explicitly in the API key allowlist.
const SENSITIVE_PATTERNS: &[&str] = &[
    "AWS_", "GCP_", "AZURE_", "GITHUB_TOKEN", "GITHUB_PAT",
    "GITLAB_TOKEN", "DOCKER_", "NPM_TOKEN", "PYPI_TOKEN",
    "DATABASE_URL", "REDIS_URL", "MONGO_URI",
];

/// Known LLM provider API key env var names (allowed through explicitly).
const LLM_API_KEY_VARS: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "GOOGLE_API_KEY",
    "GROQ_API_KEY",
    "MISTRAL_API_KEY",
    "OPENROUTER_API_KEY",
];

/// Sanitize environment variables for safe injection into VM subprocesses.
///
/// Starts with an empty map (env_clear pattern from ZeroClaw), then:
/// 1. Allows safe system vars (PATH, HOME, TERM, etc.)
/// 2. Allows explicitly configured LLM API keys
/// 3. Blocks everything else, especially sensitive credential patterns
pub fn sanitize_env(raw_env: &HashMap<String, String>) -> HashMap<String, String> {
    let mut clean = HashMap::new();

    for (key, value) in raw_env {
        if value.is_empty() {
            continue;
        }

        // Always allow safe system vars
        if SAFE_VARS.contains(&key.as_str()) {
            clean.insert(key.clone(), value.clone());
            continue;
        }

        // Always allow known LLM API keys
        if LLM_API_KEY_VARS.contains(&key.as_str()) {
            clean.insert(key.clone(), value.clone());
            continue;
        }

        // Block vars matching sensitive patterns
        let upper = key.to_uppercase();
        let is_sensitive = SENSITIVE_PATTERNS.iter().any(|pat| upper.starts_with(pat));
        if is_sensitive {
            tracing::warn!(var = %key, "Blocked sensitive env var from VM injection");
            continue;
        }

        // Block anything else containing "key", "secret", "token", "password", "credential"
        let lower = key.to_lowercase();
        if lower.contains("key") && !LLM_API_KEY_VARS.contains(&key.as_str()) {
            tracing::debug!(var = %key, "Blocked potential secret env var");
            continue;
        }
        if lower.contains("secret") || lower.contains("token")
            || lower.contains("password") || lower.contains("credential")
        {
            tracing::debug!(var = %key, "Blocked potential secret env var");
            continue;
        }

        // Allow other non-sensitive vars through
        clean.insert(key.clone(), value.clone());
    }

    clean
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_vars_pass_through() {
        let mut env = HashMap::new();
        env.insert("PATH".into(), "/usr/bin".into());
        env.insert("HOME".into(), "/workspace".into());
        env.insert("TERM".into(), "xterm-256color".into());
        let clean = sanitize_env(&env);
        assert_eq!(clean.get("PATH"), Some(&"/usr/bin".to_string()));
        assert_eq!(clean.get("HOME"), Some(&"/workspace".to_string()));
    }

    #[test]
    fn test_llm_keys_pass_through() {
        let mut env = HashMap::new();
        env.insert("ANTHROPIC_API_KEY".into(), "sk-ant-test".into());
        env.insert("OPENAI_API_KEY".into(), "sk-test".into());
        let clean = sanitize_env(&env);
        assert_eq!(clean.get("ANTHROPIC_API_KEY"), Some(&"sk-ant-test".to_string()));
        assert_eq!(clean.get("OPENAI_API_KEY"), Some(&"sk-test".to_string()));
    }

    #[test]
    fn test_sensitive_vars_blocked() {
        let mut env = HashMap::new();
        env.insert("AWS_SECRET_ACCESS_KEY".into(), "secret".into());
        env.insert("GITHUB_TOKEN".into(), "ghp_xxx".into());
        env.insert("DATABASE_URL".into(), "postgres://...".into());
        let clean = sanitize_env(&env);
        assert!(!clean.contains_key("AWS_SECRET_ACCESS_KEY"));
        assert!(!clean.contains_key("GITHUB_TOKEN"));
        assert!(!clean.contains_key("DATABASE_URL"));
    }

    #[test]
    fn test_empty_values_skipped() {
        let mut env = HashMap::new();
        env.insert("PATH".into(), "".into());
        let clean = sanitize_env(&env);
        assert!(!clean.contains_key("PATH"));
    }
}
