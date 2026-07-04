# agentii backend

Rust workspace powering the agentii agentic platform. Provides the CLI binary (`agentii`), a 40-tool execution engine, financial deep-search tools, sub-agent orchestration, a WebSocket gateway bridge, and a Skills system.

---

## Architecture

```
agentii/backend/
├── crates/
│   ├── agent/          # Core agent logic (CLI, tools, API client, …)
│   └── host/           # Infrastructure (VM, PTY proxy, WebSocket gateway)
└── skills/             # Built-in Skill bundles (markdown + YAML frontmatter)
```

The agent crates are self-contained and can run on any platform. The host crates add VM and PTY infrastructure for the full IDE experience.

---

## Crate Map

| Crate | Purpose |
|---|---|
| `agentii-cli` | `agentii` binary — REPL, one-shot `run`, `serve`, `chat --tui` |
| `agentii-core` | Session, conversation runtime, permission enforcer, config loader |
| `agentii-api` | Anthropic/OpenAI provider clients, prompt cache, streaming |
| `agentii-tools` | 40-tool dispatch engine (`execute_tool`), sub-agent orchestration |
| `agentii-financial-tools` | 8 financial Rust tools (document retrieval, statements, orders) |
| `agentii-data-api` | HTTP client for the agentii Data API (agentic retrieval endpoints) |
| `agentii-prompts` | System prompt assembly, cache-break-safe prompt building |
| `agentii-commands` | Slash-command registry (`/help`, `/clear`, `/compact`, …) |
| `agentii-plugins` | Runtime plugin loader (`.claude-plugin/plugin.json`) |
| `agentii-telemetry` | Structured event emission (LaneEvents, StaffAgent events) |
| `agentii-gateway-bridge` | WebSocket bridge — streams agent events to the IDE frontend |
| `agentii-financial-memory` | Persistent financial context and market snapshot store |
| `agentii-financial-mcp-server` | MCP server exposing financial tools over stdio |
| `agentii-compat-harness` | Compatibility shim for Claude Code protocol |
| `agentii-mock-service` | In-process mock Anthropic API for tests |
| `agentii-core` (host) | VM management, Lima/OrbStack integration |
| `agentii-pty-proxy` | PTY session proxy for terminal streaming |
| `agentii-gateway` | WebSocket gateway (port 3100) — IDE ↔ agent bridge |

---

## Quick Start

### Prerequisites

- Rust 1.75+ (`rustup update`)
- macOS or Linux

### Build the CLI

```bash
cd agentii/backend
cargo build --bin agentii
```

The binary lands at `target/debug/agentii`. For a release build:

```bash
cargo build --release --bin agentii
```

### Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or run `agentii login` for interactive key setup.

---

## CLI Usage

### Interactive REPL

```bash
agentii
# or
agentii chat
```

### TUI mode (ratatui full-screen chat)

```bash
agentii chat --tui
```

### One-shot prompt

```bash
agentii run "Summarise the last 3 commits"
agentii "What does this codebase do?"   # bare prompt also works
```

### WebSocket gateway server

```bash
agentii serve 8080
```

### Other commands

```bash
agentii --version
agentii --help
agentii status
agentii doctor
agentii skills
agentii mcp
agentii agents
agentii config set-key anthropic
```

---

## Financial Tools

Eight native Rust tools for financial document retrieval and analysis:

| Tool | Description |
|---|---|
| `fetch_filtered_document_names` | List SEC filings, earnings calls, etc. by ticker/year/type |
| `fetch_document_outline` | Map section headings and row numbers for a document |
| `fetch_document_chunk_content` | Retrieve specific pages/sections by row number |
| `search_keyword_in_source` | Full-text keyword search within a document |
| `fetch_financial_statement` | Income statement, balance sheet, cash flow by ticker |
| `fetch_stock_info` | Company profile and market data |
| `read_market_context` | Read local market snapshot (`.agentii/market-context/snapshot.json`) |
| `stage_order` | Stage a trade order to `.agentii/orders/staged.json` |

These tools are registered automatically when the agent starts. The `agentic-search` Skill bundles them into a 4-step retrieval strategy.

---

## Sub-Agents

agentii supports five built-in sub-agent types:

| Type | Tool access | Use case |
|---|---|---|
| `general-purpose` | Full tool suite | Default agent |
| `Explore` | Read-only (no write/bash) | Codebase exploration |
| `Plan` | Read + TodoWrite + StructuredOutput | Planning and spec writing |
| `Verification` | Read + bash (no write) | Test running, verification |
| `financial-retrieval` | Financial tools + read | Document retrieval |

Spawn a sub-agent from a prompt with the `Agent` tool, or via `agentii run` with a sub-agent type flag.

---

## Skills

Skills are markdown bundles with YAML frontmatter stored in `agentii/backend/skills/`. Each skill declares the tools it needs and provides a system-prompt extension.

Built-in skills:

- `agentic-search` — 4-step financial document retrieval strategy
- `earnings-analysis` — Earnings call analysis workflow
- `financial-analyst` — Full financial analyst persona

See [`docs/skill-authoring.md`](docs/skill-authoring.md) for how to write your own skills.

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `AGENTII_DATA_BASE_URL` | `https://api.agentii.ai` | Data API base URL |
| `AGENTII_API_KEY` | — | agentii Data API key |
| `AGENTII_CONFIG_HOME` | `~/.agentii` | Config directory |
| `CLAUDE_CONFIG_HOME` | `~/.claude` | Claude-compat config dir |
| `RUSTY_CLAUDE_PERMISSION_MODE` | `danger-full-access` | Default permission mode |
| `RUST_LOG` | `warn` | Log level (tracing) |

Permission modes: `read-only`, `accept-edits`, `workspace-write`, `danger-full-access`.

---

## Running Tests

```bash
cargo test --workspace
```

Individual crate:

```bash
cargo test -p agentii-tools
cargo test -p agentii-api
```

---

## Gateway (IDE integration)

The WebSocket gateway bridges the IDE frontend to the agent runtime:

```bash
cargo run -p agentii-gateway -- --port 3100
```

The frontend connects to `ws://localhost:3100/ws/chat`. See [`README_quickstart.md`](README_quickstart.md) for full gateway setup.
