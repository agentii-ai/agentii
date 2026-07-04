//! Connects agentii-core ConversationRuntime output to the agentii-gateway WebSocket infrastructure.
//! Maps StreamEvent → AgentEvent → EventFrame (Channel 2 structured events).

pub mod bridge;
pub use bridge::GatewayBridge;
