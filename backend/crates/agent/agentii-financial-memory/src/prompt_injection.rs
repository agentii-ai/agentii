//! Financial prompt injection for SystemPromptBuilder.
use crate::parser::AgentiiMdParsed;
use agentii_prompts::financial_context_section;

pub struct FinancialPromptInjector;

impl FinancialPromptInjector {
    /// Build the financial context block for injection into the system prompt dynamic suffix.
    pub fn build_context_block(parsed: &AgentiiMdParsed) -> Option<String> {
        if parsed.level1_content.is_empty() {
            return None;
        }
        let snapshot_ref = parsed.today_snapshot.as_deref();
        Some(financial_context_section(&parsed.level1_content, snapshot_ref))
    }
}
