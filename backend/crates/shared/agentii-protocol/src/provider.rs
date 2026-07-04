use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::messages::{ChatMessage, CompletionResponse};
use crate::stream::StreamEvent;

/// Trait for LLM providers (Anthropic, OpenAI, DeepSeek, etc.).
#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// Provider identifier (e.g., "anthropic", "openai").
    fn name(&self) -> &str;

    /// Default model for this provider.
    fn default_model(&self) -> &str;

    /// Complete a conversation (non-streaming).
    async fn complete(
        &self,
        messages: &[ChatMessage],
        tools: &[serde_json::Value],
        model: Option<&str>,
    ) -> Result<CompletionResponse, ProviderError>;

    /// Complete a conversation with streaming.
    async fn complete_stream(
        &self,
        messages: &[ChatMessage],
        tools: &[serde_json::Value],
        model: Option<&str>,
        event_tx: tokio::sync::mpsc::Sender<StreamEvent>,
    ) -> Result<CompletionResponse, ProviderError>;

    /// Check if the provider is configured (has API key, etc.).
    fn is_configured(&self) -> bool;

    /// List available models.
    fn available_models(&self) -> Vec<ModelInfo>;
}

/// Information about an available model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub display_name: String,
    pub context_window: u32,
    pub max_output_tokens: u32,
    pub supports_tools: bool,
    pub supports_streaming: bool,
    pub supports_thinking: bool,
}

/// Provider errors.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("Rate limited: retry after {retry_after_ms}ms")]
    RateLimited { retry_after_ms: u64 },

    #[error("Server error ({status}): {message}")]
    ServerError { status: u16, message: String },

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Context overflow: {used} tokens used, {limit} limit")]
    ContextOverflow { used: u32, limit: u32 },

    #[error("Network error: {0}")]
    Network(String),

    #[error("Not configured: {0}")]
    NotConfigured(String),

    #[error("{0}")]
    Other(String),
}
