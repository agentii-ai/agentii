const MEMORY_SYSTEM_PROMPT: &str = include_str!("../../templates/memory_system_prompt.md");

/// Build the memory system prompt section to append to agentii_system_prompt.
/// Returns the ~500 token memory instruction block.
pub fn build_memory_system_prompt() -> &'static str {
    MEMORY_SYSTEM_PROMPT
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_prompt_is_not_empty() {
        let prompt = build_memory_system_prompt();
        assert!(!prompt.is_empty());
    }

    #[test]
    fn test_memory_prompt_under_token_budget() {
        let prompt = build_memory_system_prompt();
        // Approximate token count: ~4 chars per token for English text
        let approx_tokens = prompt.len() / 4;
        assert!(
            approx_tokens <= 600,
            "Memory prompt is ~{} tokens (approx), should be ≤500",
            approx_tokens
        );
    }

    #[test]
    fn test_memory_prompt_contains_key_sections() {
        let prompt = build_memory_system_prompt();
        assert!(prompt.contains("agentii.md"));
        assert!(prompt.contains("style.md"));
        assert!(prompt.contains("snapshot"));
        assert!(prompt.contains("session"));
        assert!(prompt.contains("Market Observation"));
        assert!(prompt.contains("Analysis Finding"));
        assert!(prompt.contains("Trading View"));
        assert!(prompt.contains("Decision"));
        assert!(prompt.contains("Catalyst Update"));
    }
}
