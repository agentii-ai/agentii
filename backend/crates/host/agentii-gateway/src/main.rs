use std::sync::Arc;

use clap::Parser;
use tracing_subscriber::EnvFilter;

use agentii_pty_proxy::pty_manager::PtyManager;

/// Agentii Gateway — WebSocket routing server for terminal + agent channels.
#[derive(Parser)]
#[command(name = "agentii-gateway", version, about)]
struct Args {
    /// Port to listen on.
    #[arg(short, long, default_value_t = 3100)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let pty_manager = Arc::new(PtyManager::new());
    let server = agentii_gateway::server::GatewayServer::new(args.port, pty_manager).await;
    server.run().await
}
