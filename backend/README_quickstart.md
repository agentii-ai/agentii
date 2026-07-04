# Agentii Backend Quickstart

This guide walks you through rebuilding and starting the Agentii backend service (gateway). The backend consists of a WebSocket gateway that manages VM instances, terminal PTY sessions, and CLI agent provisioning.

## Quick Rebuild & Start

If you just want to rebuild and start the gateway (after making changes), run:

```bash
cd /Users/frank/A/agenzym/agentii/backend
cargo build --release
pkill -f agentii-gateway  # stop any existing gateway
cargo run -p agentii-gateway -- --port 3100
```

For development (faster builds, logging enabled):

```bash
cd /Users/frank/A/agenzym/agentii/backend
cargo build
RUST_LOG=info cargo run -p agentii-gateway
```

## Prerequisites

- **Rust 1.75+** (stable) – install via [rustup](https://rustup.rs/)
- **Lima** (for VM support) – `brew install lima` on macOS, or [install manually](https://github.com/lima-vm/lima)
- **OrbStack** (alternative to Lima) – optional, [orbstack.com](https://orbstack.com/)

> **Note:** The backend can run without Lima/OrbStack, but VM features (project workspaces, CLI agents) will be limited. For full functionality, install Lima or OrbStack before proceeding.

## Configuration (Optional)

The gateway can inject LLM provider API keys into CLI agent environments. To set up keys, copy the example environment file and fill in your keys:

```bash
cd /Users/frank/A/agenzym/agentii/backend
cp .env.example .env.local
# Edit .env.local with your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
```

The gateway will read these keys at startup and make them available to CLI agents (Goose, Claude Code, etc.) via environment variables.

> **Note:** 
> - `.env.local` is gitignored; never commit real API keys.
> - Keys are never written to disk inside VMs; they are passed via environment variables only.
> - If no keys are provided, CLI agents will prompt for them (or fail if required).

## Building the Backend

1. Navigate to the backend directory:

   ```bash
   cd /Users/frank/A/agenzym/agentii/backend
   ```

2. Build all crates (optional, but recommended for first run):

   ```bash
   cargo build --release
   ```

   This compiles the gateway binary (`target/release/agentii-gateway`) and all dependencies. Use `--release` for production performance, omit for faster development builds.

3. Verify the build succeeded:

   ```bash
   cargo run -p agentii-gateway -- --help
   ```

   You should see the command-line help for the gateway.

## Starting the Gateway

The gateway listens on port **3100** by default (matches the frontend’s `VITE_WS_URL`). Start it with:

```bash
cd /Users/frank/A/agenzym/agentii/backend
cargo run -p agentii-gateway -- --port 3100
```

### Running in the Background

To keep the gateway running after closing your terminal:

```bash
cargo run -p agentii-gateway -- --port 3100 &
```

Or use a process manager like `tmux` or `screen`.

### Controlling Log Verbosity

The gateway uses `tracing` for structured logging. By default it logs at `info` level, which is verbose. To reduce noise:

```bash
# Only warnings and errors
RUST_LOG=warn cargo run -p agentii-gateway -- --port 3100

# Info for the gateway only, warnings elsewhere
RUST_LOG=agentii_gateway=info,warn cargo run -p agentii-gateway -- --port 3100
```

## Testing the Gateway

Once the gateway is running, verify it’s responding:

1. **Test workspace initialization** (requires a project ID):

   ```bash
   curl -s -X POST http://localhost:3100/api/workspace/init \
     -H "Content-Type: application/json" \
     -d '{"project_id":"test-123","user_id":"local","agentii_md":"# Test"}'
   ```

   Expected response: `{"workspace_path":"...","agentii_md_exists":true,"context_files_generated":true}`

2. **Verify WebSocket connection**:

   You can use a WebSocket client (e.g., `websocat`) to connect to `ws://localhost:3100/ws/chat`. The frontend will automatically connect when you open a project.

   Example using `websocat` (install via `brew install websocat`):

   ```bash
   websocat ws://localhost:3100/ws/chat
   ```

   You should see the gateway accept the connection and log a new WebSocket session.

> **Note:** The gateway does not expose a general-purpose HTTP health endpoint; it only responds to WebSocket upgrade requests and the `/api/workspace/init` POST endpoint.

## Integration with Frontend

1. Ensure the frontend’s `.env.local` includes:
   ```
   VITE_WS_URL=ws://localhost:3100/ws/chat
   ```

2. Start the frontend dev server (from `agentii/frontend`):
   ```bash
   npm run dev
   ```

3. Create a new project in the frontend – the gateway will handle VM provisioning, terminal sessions, and CLI agent readiness.

## Troubleshooting

### “Gateway starts but logs are overwhelming”
Set `RUST_LOG=warn` as shown above. The gateway logs every WebSocket connection, workspace init, and PTY session – this is normal.

### “Lima not found” warnings
If you see `LimaBackend not available, VM features disabled`, install Lima:

```bash
brew install lima
limactl start
```

Or install OrbStack (macOS) for a more integrated experience.

### “Port 3100 already in use”
Kill any existing gateway processes:

```bash
pkill -f agentii-gateway
```

Or run the gateway on a different port and update the frontend’s `VITE_WS_URL` accordingly.

### “Build fails due to missing dependencies”
Ensure you have the latest Rust toolchain:

```bash
rustup update
```

If you encounter linker errors on macOS, you may need the Xcode command-line tools:

```bash
xcode-select --install
```

## Advanced: VM Base Image

For full CLI agent readiness (Goose, Claude Code, OpenCode, Codex), the backend needs a pre‑built Lima VM image. This image includes all CLI tools and MCP servers.

To build the base image (requires Lima):

```bash
cd /Users/frank/A/agenzym/agentii/backend
./scripts/build-vm-image.sh
```

The script creates a Lima VM named `agentii-base`. The gateway will automatically clone this base image for each new project.

## Next Steps

- Read the [architecture overview](../../specs/005-frontend-backend-integration/spec.md) for how the gateway fits into the system.
- Explore the [CLI agent readiness specs](../../specs/015-cli-agent-readiness/spec.md) for details on instant CLI provisioning.
- Check `agentii/backend/.env.example` for optional environment variables (API keys, provider overrides).

## Need Help?

- Open an issue on the repository.
- Check existing logs with `RUST_LOG=debug` for detailed debugging output.