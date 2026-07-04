use serde::{Deserialize, Serialize};
use tracing::{info, warn};

const SYSTEM_PROMPT: &str = r#"You are the project setup assistant for agentii.ai — a financial analysis and live trading platform.

Your job: help the user create a new project by collecting:
1. Primary ticker symbol(s) — e.g., AAPL, NVDA, BTC, ETH
2. Project type — one of: us_stock, us_stock_option, crypto, predictive_market

Guidelines:
- If the user mentions specific stocks/crypto, extract the tickers immediately
- Auto-detect project type from the tickers (stocks → us_stock, crypto → crypto, options mentions → us_stock_option)
- Generate a concise project name from the tickers and user intent (e.g., "NVDA Earnings Analysis", "BTC Swing Trade")
- If the user's message doesn't contain tickers, ask them naturally: "Which ticker(s) are you interested in?"
- Keep responses short and conversational (2-3 sentences max)
- When you have enough info, include this JSON block at the end of your message:

:::PROJECT_READY
{"name": "...", "tickers": ["AAPL"], "project_type": "us_stock", "description": "..."}
:::

Only include the PROJECT_READY block when you're confident about the tickers and type."#;

/// Provider-specific API configuration.
struct ProviderConfig {
    api_url: &'static str,
    auth_header: &'static str,
    auth_prefix: &'static str,
}

fn resolve_provider(provider: &str) -> Option<ProviderConfig> {
    match provider {
        "deepseek" => Some(ProviderConfig {
            api_url: "https://api.deepseek.com/v1/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        "openai" => Some(ProviderConfig {
            api_url: "https://api.openai.com/v1/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        "anthropic" => Some(ProviderConfig {
            api_url: "https://api.anthropic.com/v1/messages",
            auth_header: "x-api-key",
            auth_prefix: "",
        }),
        "gemini" => Some(ProviderConfig {
            api_url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        "groq" => Some(ProviderConfig {
            api_url: "https://api.groq.com/openai/v1/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        "mistral" => Some(ProviderConfig {
            api_url: "https://api.mistral.ai/v1/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        "openrouter" => Some(ProviderConfig {
            api_url: "https://openrouter.ai/api/v1/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        "cerebras" => Some(ProviderConfig {
            api_url: "https://api.cerebras.ai/v1/chat/completions",
            auth_header: "Authorization",
            auth_prefix: "Bearer ",
        }),
        _ => None,
    }
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    /// The provider name (e.g., "deepseek", "openai"). Defaults to "deepseek".
    #[serde(default = "default_provider")]
    pub provider: String,
    /// The model ID (e.g., "deepseek-chat", "gpt-4o"). Defaults to "deepseek-chat".
    #[serde(default = "default_model")]
    pub model: String,
    /// The API key for the provider. Sent from the frontend (fetched from Supabase Vault).
    #[serde(default)]
    pub api_key: String,
}

fn default_provider() -> String { "deepseek".into() }
fn default_model() -> String { "deepseek-chat".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub project: Option<ProjectReady>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectReady {
    pub name: String,
    pub tickers: Vec<String>,
    pub project_type: String,
    pub description: String,
}

#[derive(Debug, Serialize)]
struct CompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

/// Anthropic uses a different request format.
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Deserialize)]
struct CompletionResponse {
    choices: Vec<CompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct CompletionChoice {
    message: CompletionMessage,
}

#[derive(Debug, Deserialize)]
struct CompletionMessage {
    content: String,
}

/// Anthropic response format.
#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    text: String,
}

/// Parse the :::PROJECT_READY block from the assistant's response.
fn parse_project_ready(content: &str) -> Option<ProjectReady> {
    let start_marker = ":::PROJECT_READY";
    let end_marker = ":::";

    let start = content.find(start_marker)?;
    let after_marker = start + start_marker.len();
    let rest = &content[after_marker..];
    let rest_trimmed = rest.trim_start();
    let end = rest_trimmed.find(end_marker)?;
    let json_str = rest_trimmed[..end].trim();

    serde_json::from_str::<ProjectReady>(json_str).ok()
}

/// Strip the :::PROJECT_READY block from the visible message content.
fn strip_project_block(content: &str) -> String {
    let start_marker = ":::PROJECT_READY";
    if let Some(start) = content.find(start_marker) {
        let before = content[..start].trim_end();
        let after_start = start + start_marker.len();
        let rest = &content[after_start..];
        let rest_trimmed = rest.trim_start();
        if let Some(end) = rest_trimmed.find(":::") {
            let after = rest_trimmed[end + 3..].trim_start();
            if after.is_empty() {
                before.to_string()
            } else {
                format!("{}\n{}", before, after)
            }
        } else {
            before.to_string()
        }
    } else {
        content.to_string()
    }
}

/// Handle a POST /api/chat/setup request.
///
/// `fallback_api_key`: the DeepSeek API key from env (fallback if not provided in request).
/// `body`: the raw JSON request body bytes.
///
/// Returns `(status_code, response_json_bytes)`.
pub async fn handle_chat_setup(fallback_api_key: &str, body: &[u8]) -> (u16, Vec<u8>) {
    let request: ChatRequest = match serde_json::from_slice(body) {
        Ok(r) => r,
        Err(e) => {
            let err = serde_json::json!({ "error": format!("Invalid request body: {e}") });
            return (400, serde_json::to_vec(&err).unwrap());
        }
    };

    // Use the key from the request body (from Supabase Vault), fall back to env var
    let api_key = if !request.api_key.is_empty() {
        &request.api_key
    } else {
        fallback_api_key
    };

    if api_key.is_empty() {
        let err = serde_json::json!({
            "error": format!(
                "No API key configured for {}. Add one in Settings → LLM Providers.",
                request.provider
            )
        });
        return (503, serde_json::to_vec(&err).unwrap());
    }

    let provider_config = match resolve_provider(&request.provider) {
        Some(c) => c,
        None => {
            let err = serde_json::json!({ "error": format!("Unsupported provider: {}", request.provider) });
            return (400, serde_json::to_vec(&err).unwrap());
        }
    };

    info!(provider = %request.provider, model = %request.model, "Chat setup request");

    let client = reqwest::Client::new();

    // Anthropic uses a different request/response format
    let is_anthropic = request.provider == "anthropic";

    let result = if is_anthropic {
        // Filter out system messages — Anthropic uses a top-level `system` field
        let user_messages: Vec<ChatMessage> = request.messages.into_iter()
            .filter(|m| m.role != "system")
            .collect();

        let anthropic_req = AnthropicRequest {
            model: request.model.clone(),
            max_tokens: 1024,
            system: SYSTEM_PROMPT.into(),
            messages: user_messages,
        };

        client
            .post(provider_config.api_url)
            .header(provider_config.auth_header, format!("{}{}", provider_config.auth_prefix, api_key))
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .json(&anthropic_req)
            .send()
            .await
    } else {
        let mut messages = vec![ChatMessage {
            role: "system".into(),
            content: SYSTEM_PROMPT.into(),
        }];
        messages.extend(request.messages);

        let completion_req = CompletionRequest {
            model: request.model.clone(),
            messages,
        };

        client
            .post(provider_config.api_url)
            .header(provider_config.auth_header, format!("{}{}", provider_config.auth_prefix, api_key))
            .header("Content-Type", "application/json")
            .json(&completion_req)
            .send()
            .await
    };

    let http_resp = match result {
        Ok(r) => r,
        Err(e) => {
            warn!(error = %e, "LLM API request failed");
            let err = serde_json::json!({ "error": format!("API error: {e}") });
            return (502, serde_json::to_vec(&err).unwrap());
        }
    };

    if !http_resp.status().is_success() {
        let status = http_resp.status().as_u16();
        let body_text = http_resp.text().await.unwrap_or_default();
        warn!(status, body = %body_text, "LLM API returned error");
        let err = serde_json::json!({ "error": format!("API returned {status}: {body_text}") });
        return (502, serde_json::to_vec(&err).unwrap());
    }

    // Parse response based on provider format
    let assistant_content = if is_anthropic {
        match http_resp.json::<AnthropicResponse>().await {
            Ok(r) => r.content.first().map(|c| c.text.clone()).unwrap_or_default(),
            Err(e) => {
                warn!(error = %e, "Failed to parse Anthropic response");
                let err = serde_json::json!({ "error": format!("Failed to parse response: {e}") });
                return (502, serde_json::to_vec(&err).unwrap());
            }
        }
    } else {
        match http_resp.json::<CompletionResponse>().await {
            Ok(r) => r.choices.first().map(|c| c.message.content.clone()).unwrap_or_default(),
            Err(e) => {
                warn!(error = %e, "Failed to parse LLM response");
                let err = serde_json::json!({ "error": format!("Failed to parse response: {e}") });
                return (502, serde_json::to_vec(&err).unwrap());
            }
        }
    };

    info!(provider = %request.provider, chars = assistant_content.len(), "LLM response received");

    let project = parse_project_ready(&assistant_content);
    let visible_content = strip_project_block(&assistant_content);

    let response = ChatResponse {
        content: visible_content,
        project,
    };

    (200, serde_json::to_vec(&response).unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_project_ready() {
        let content = r#"Great choice! I'll set up an NVDA analysis project for you.

:::PROJECT_READY
{"name": "NVDA Earnings Analysis", "tickers": ["NVDA"], "project_type": "us_stock", "description": "Analysis of NVIDIA earnings and price action"}
:::"#;

        let project = parse_project_ready(content).unwrap();
        assert_eq!(project.name, "NVDA Earnings Analysis");
        assert_eq!(project.tickers, vec!["NVDA"]);
        assert_eq!(project.project_type, "us_stock");
    }

    #[test]
    fn test_parse_project_ready_missing() {
        let content = "Which ticker(s) are you interested in?";
        assert!(parse_project_ready(content).is_none());
    }

    #[test]
    fn test_strip_project_block() {
        let content = r#"Great choice!

:::PROJECT_READY
{"name": "NVDA", "tickers": ["NVDA"], "project_type": "us_stock", "description": "test"}
:::"#;

        let stripped = strip_project_block(content);
        assert_eq!(stripped, "Great choice!");
    }

    #[test]
    fn test_strip_no_block() {
        let content = "Which tickers?";
        assert_eq!(strip_project_block(content), "Which tickers?");
    }

    #[test]
    fn test_resolve_provider_known() {
        assert!(resolve_provider("deepseek").is_some());
        assert!(resolve_provider("openai").is_some());
        assert!(resolve_provider("anthropic").is_some());
        assert!(resolve_provider("gemini").is_some());
        assert!(resolve_provider("groq").is_some());
        assert!(resolve_provider("mistral").is_some());
        assert!(resolve_provider("openrouter").is_some());
        assert!(resolve_provider("cerebras").is_some());
    }

    #[test]
    fn test_resolve_provider_unknown() {
        assert!(resolve_provider("unknown").is_none());
    }
}
