//! Financial prompt string constants for agentii-rust-core.
//! Pure data crate — no dependency on agentii-core to avoid circular deps.

pub mod agentic_search;
pub mod financial_analyst;
pub mod financial_context;
pub mod financial_retrieval_agent;

pub use agentic_search::agentic_search_strategy_section;
pub use financial_analyst::financial_analyst_role_section;
pub use financial_context::financial_context_section;
pub use financial_retrieval_agent::financial_retrieval_agent_section;
