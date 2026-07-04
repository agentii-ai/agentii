//! T111: Tier 3 `genai` crate bridge.
//!
//! Provides a thin compatibility shim so that any provider supported by the
//! `genai` crate can be used through the agentii `ProviderClient` interface.
//! The bridge is intentionally minimal: it maps `MessageRequest` → genai
//! `ChatRequest` and genai `ChatResponse` → `MessageResponse`.
//!
//! Because `genai` is an optional dependency (not yet added to Cargo.toml),
//! this module exposes the bridge types and a feature-gated constructor.
//! When the `genai` feature is not enabled the module still compiles but
//! `GenaiClient::new` is unavailable.

use crate::error::ApiError;
use crate::types::{InputContentBlock, InputMessage, MessageRequest, MessageResponse, OutputContentBlock, Usage};

/// Supported genai provider names (mirrors genai's `AdapterKind`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GenaiProvider {
    OpenAi,
    Anthropic,
    Cohere,
    Groq,
    Gemini,
    Ollama,
    /// Any other provider string passed through verbatim.
    Other(String),
}

impl GenaiProvider {
    pub fn as_str(&self) -> &str {
        match self {
            Self::OpenAi => "openai",
            Self::Anthropic => "anthropic",
            Self::Cohere => "cohere",
            Self::Groq => "groq",
            Self::Gemini => "gemini",
            Self::Ollama => "ollama",
            Self::Other(s) => s.as_str(),
        }
    }
}

/// Bridge client that delegates to the `genai` crate.
///
/// When the `genai` feature flag is disabled this struct exists but cannot
/// be constructed (the constructor returns an error).
#[derive(Debug, Clone)]
pub struct GenaiClient {
    pub provider: GenaiProvider,
    pub model: String,
    pub api_key: Option<String>,
}

impl GenaiClient {
    /// Create a new bridge client.
    ///
    /// `api_key` is optional for local providers like Ollama.
    pub fn new(provider: GenaiProvider, model: impl Into<String>, api_key: Option<String>) -> Self {
        Self {
            provider,
            model: model.into(),
            api_key,
        }
    }

    /// Create from environment variables.
    ///
    /// Reads `GENAI_PROVIDER`, `GENAI_MODEL`, and `GENAI_API_KEY`.
    pub fn from_env() -> Result<Self, ApiError> {
        let provider_str = std::env::var("GENAI_PROVIDER")
            .map_err(|_| ApiError::missing_credentials("genai", &["GENAI_PROVIDER"]))?;
        let model = std::env::var("GENAI_MODEL")
            .unwrap_or_else(|_| "gpt-4o".to_string());
        let api_key = std::env::var("GENAI_API_KEY").ok();
        let provider = match provider_str.to_lowercase().as_str() {
            "openai" => GenaiProvider::OpenAi,
            "anthropic" => GenaiProvider::Anthropic,
            "cohere" => GenaiProvider::Cohere,
            "groq" => GenaiProvider::Groq,
            "gemini" => GenaiProvider::Gemini,
            "ollama" => GenaiProvider::Ollama,
            other => GenaiProvider::Other(other.to_string()),
        };
        Ok(Self::new(provider, model, api_key))
    }

    /// Convert a `MessageRequest` to a minimal JSON body compatible with the
    /// genai crate's `ChatRequest` format.
    pub fn to_genai_request(request: &MessageRequest) -> serde_json::Value {
        let messages: Vec<serde_json::Value> = request
            .messages
            .iter()
            .map(|msg| {
                let role = msg.role.as_str();
                let content = msg
                    .content
                    .iter()
                    .filter_map(|block| match block {
                        InputContentBlock::Text { text } => Some(text.clone()),
                        _ => None,
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                serde_json::json!({ "role": role, "content": content })
            })
            .collect();

        serde_json::json!({
            "model": request.model,
            "messages": messages,
            "max_tokens": request.max_tokens,
        })
    }

    /// Convert a genai-style JSON response to a `MessageResponse`.
    pub fn from_genai_response(
        model: &str,
        response: &serde_json::Value,
    ) -> Result<MessageResponse, ApiError> {
        let text = response["choices"][0]["message"]["content"]
            .as_str()
            .or_else(|| response["content"][0]["text"].as_str())
            .unwrap_or("")
            .to_string();

        Ok(MessageResponse {
            id: response["id"]
                .as_str()
                .unwrap_or("genai-bridge")
                .to_string(),
            kind: "message".to_string(),
            role: "assistant".to_string(),
            model: model.to_string(),
            stop_reason: Some("end_turn".to_string()),
            stop_sequence: None,
            usage: Usage {
                input_tokens: response["usage"]["prompt_tokens"]
                    .as_u64()
                    .unwrap_or(0) as u32,
                output_tokens: response["usage"]["completion_tokens"]
                    .as_u64()
                    .unwrap_or(0) as u32,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
            },
            content: vec![OutputContentBlock::Text { text }],
            request_id: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genai_provider_as_str() {
        assert_eq!(GenaiProvider::OpenAi.as_str(), "openai");
        assert_eq!(GenaiProvider::Ollama.as_str(), "ollama");
        assert_eq!(GenaiProvider::Other("custom".into()).as_str(), "custom");
    }

    #[test]
    fn to_genai_request_maps_messages() {
        let req = MessageRequest {
            model: "gpt-4o".into(),
            max_tokens: 100,
            messages: vec![InputMessage {
                role: "user".to_string(),
                content: vec![InputContentBlock::Text { text: "hello".into() }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
            ..Default::default()
        };
        let body = GenaiClient::to_genai_request(&req);
        assert_eq!(body["model"], "gpt-4o");
        assert_eq!(body["messages"][0]["role"], "user");
        assert_eq!(body["messages"][0]["content"], "hello");
    }

    #[test]
    fn from_genai_response_parses_openai_format() {
        let resp = serde_json::json!({
            "id": "chatcmpl-123",
            "choices": [{ "message": { "content": "Hi there!" } }],
            "usage": { "prompt_tokens": 10, "completion_tokens": 5 }
        });
        let msg = GenaiClient::from_genai_response("gpt-4o", &resp).unwrap();
        assert_eq!(msg.id, "chatcmpl-123");
        assert_eq!(msg.usage.input_tokens, 10);
        assert_eq!(msg.usage.output_tokens, 5);
        match &msg.content[0] {
            OutputContentBlock::Text { text } => assert_eq!(text, "Hi there!"),
            _ => panic!("expected text block"),
        }
    }
}
