Mac.

  ---
  Prerequisites

  # 1. Rust toolchain
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

  # 2. Node.js 20+ (if not installed)
  brew install node

  # 3. Supabase CLI
  brew install supabase/tap/supabase

  # 4. Docker Desktop (required by Supabase local)
  # Download from https://docker.com/products/docker-desktop — must be running

  # 5. OrbStack (recommended VM backend for macOS — faster than Lima)
  brew install orbstack
  # OR Lima:
  # brew install lima

  Step 1: Start Supabase Local

  cd /Users/frank/A/agenzym

  # Start all Supabase services (Postgres, Auth, Storage, Studio)
  supabase start

  # Apply migrations + seed data
  supabase db push
  supabase db reset  # if you want seed data (featured templates)

  This gives you:
  - API: http://localhost:54321
  - Studio: http://localhost:54323 (browse your DB here)
  - anon key + service_role key printed to terminal — copy the anon key

  Step 2: Configure Frontend Environment

  cd /Users/frank/A/agenzym/agentii/frontend

  # Edit .env.local with the keys from supabase start output
  cat > .env.local << 'EOF'
  VITE_SUPABASE_URL=http://localhost:54321
  VITE_SUPABASE_ANON_KEY=<paste-anon-key-here>
  VITE_WS_URL=ws://localhost:3100/ws/chat
  VITE_GATEWAY_WS_URL=ws://localhost:3100
  VITE_LEGACY_CHAT_PANEL=false
  EOF

  Step 3: Build & Run the Rust Backend

  cd /Users/frank/A/agenzym/agentii/backend

  # Build everything (first build takes ~2-3 min)
  cargo build

  # Run the gateway (WebSocket relay proxy on port 3100)
  cargo run --bin agentii-gateway -- --port 3100

  Keep this terminal open. The gateway is the relay between your browser and the VM.

  Step 4: Start the Frontend

  In a new terminal:

  cd /Users/frank/A/agenzym/agentii/frontend
  npm install   # or pnpm install
  npm run dev

  Open http://localhost:5173 — you should see the login page. Sign up, then you'll land on /projects.

  Step 5: Set Up the VM with OrbStack

  This is where the agent CLIs run. The VM is a lightweight Linux instance.

  # Create an Ubuntu VM via OrbStack
  orb create ubuntu agentii-vm

  # Shell into it
  orb shell agentii-vm

  Inside the VM, install the CLIs you want:

  Install Goose CLI

  # Inside the VM
  curl -fsSL https://github.com/block/goose/releases/latest/download/download_cli.sh | CONFIGURE=false bash

  # Verify
  goose --version

  Install OpenCode CLI

  # Inside the VM
  go install github.com/opencode-ai/opencode@latest
  # OR if Go isn't installed:
  curl -fsSL https://raw.githubusercontent.com/opencode-ai/opencode/main/install.sh | bash

  # Verify
  opencode --version

  Install edgartools-mcp (shared financial data tools)

  # Inside the VM
  pip install edgartools mcp

  # Test it
  python -c "from edgartools import Company; print(Company('AAPL'))"

  Configure MCP for Goose

  # Inside the VM
  mkdir -p ~/.config/goose
  cat > ~/.config/goose/profiles.yaml << 'EOF'
  default:
    provider: anthropic
    extensions:
      edgartools:
        type: stdio
        cmd: python
        args: ["-m", "edgar.ai"]
  EOF

  Configure MCP for OpenCode

  # Inside the VM
  mkdir -p ~/.config/opencode
  cat > ~/.config/opencode/config.json << 'EOF'
  {
    "mcpServers": {
      "edgartools": {
        "command": "python",
        "args": ["-m", "edgar.ai"]
      }
    }
  }
  EOF

  Set API Keys Inside the VM

  # Inside the VM — set your LLM provider keys
  export ANTHROPIC_API_KEY=sk-ant-...
  export OPENAI_API_KEY=sk-...

  # For Goose
  goose configure  # interactive setup

  # For OpenCode — it reads env vars automatically

  Step 6: Connect the VM to the Gateway

  The gateway needs to know about the VM to proxy PTY sessions. For local dev, the simplest approach is to run agentii serve inside the VM, which starts the agent server + PTY manager:

  # Inside the VM — if agentii-cli is built
  # From your host, copy the binary:
  # (in a host terminal)
  orb push agentii-vm /Users/frank/A/agenzym/agentii/backend/target/debug/agentii-cli /usr/local/bin/agentii

  # Inside the VM
  agentii serve --port 9100

  For now, if agentii serve isn't fully wired yet, you can test the CLIs directly inside the VM:

  # Inside the VM
  cd /workspace  # or any project directory

  # Test Goose
  goose run "What are the latest SEC filings for AAPL?"

  # Test OpenCode
  opencode "Analyze the latest 10-K for LLY"

  Step 7: Create a Project and Test

  1. Open http://localhost:5173
  2. Sign up / log in
  3. Click "New Project" → name it "LLY Catalyst", ticker "LLY", type "Catalyst"
  4. A new window opens at /ide?project=<uuid>
  5. The terminal panel should connect to the VM (if gateway ↔ VM relay is wired)
  6. If not yet wired, you can still use the file tree, project management, and settings

  Architecture Recap

  Browser (localhost:5173)
      ↕ WebSocket
  Gateway (localhost:3100)  ← relay only, no agent logic
      ↕ PTY proxy + Channel 2
  OrbStack VM (agentii-vm)
      ├── agentii serve (agent server)
      ├── goose (CLI)
      ├── opencode (CLI)
      ├── edgartools-mcp (MCP server)
      └── /workspace/ (project files via virtiofs)

  Quick Troubleshooting

  ┌────────────────────────────────────────────┬──────────────────────────────────────────────────┐
  │                   Issue                    │                       Fix                        │
  ├────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ supabase start fails                       │ Make sure Docker Desktop is running              │
  ├────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ Frontend shows "Missing VITE_SUPABASE_URL" │ Check .env.local has the correct values          │
  ├────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ Gateway won't start                        │ Check port 3100 isn't in use: lsof -i :3100      │
  ├────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ VM can't reach host                        │ OrbStack VMs can reach host at host.orb.internal │
  ├────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ Goose can't find edgartools                │ Run pip install edgartools mcp inside the VM     │
  ├────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ cargo build fails                          │ Run rustup update to get latest toolchain        │
  └────────────────────────────────────────────┴──────────────────────────────────────────────────┘
  

  Start the gateway (port 3100 — what the frontend expects):

  cd /Users/frank/A/agenzym/agentii/backend
  ./target/debug/agentii-gateway --port 3100

  Start the frontend (separate terminal):

  cd /Users/frank/A/agenzym/agentii/frontend
  npm run dev

  Supabase is already running on port 54321 and I've updated .env.local to point to the local instance.

  For the VM setup with Goose/OpenCode — you have Lima installed. To create a workspace VM:

  limactl create --name=agentii-workspace --cpus=2 --memory=4 --disk=20 template://default
  limactl start agentii-workspace

  Then inside the VM, install the CLIs:

  # Goose CLI (already on your host at ~/.cargo/bin/goose)
  limactl shell agentii-workspace -- bash -c "curl -fsSL https://github.com/block/goose/releases/latest/download/goose-aarch64-unknown-linux-gnu -o /usr/local/bin/goose && chmod +x
  /usr/local/bin/goose"

  # OpenCode CLI
  limactl shell agentii-workspace -- bash -c "curl -fsSL https://opencode.ai/install.sh | bash"


  