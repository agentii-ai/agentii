# edgartools-mcp: SEC EDGAR MCP Server for Agentii VMs

## Overview
Runs as a persistent MCP server process inside each project VM, providing SEC EDGAR
data tools to all agent CLIs (agentii-cli, Claude Code, Goose, OpenCode).

## Installation (inside VM)
```bash
pip install edgartools mcp
python -m edgar.ai
```

## MCP Tools Provided
- `search_companies` — Search SEC EDGAR for companies by name or CIK
- `get_company_filings` — Get recent filings for a company
- `get_filing_content` — Download and parse a specific filing
- `get_xbrl_financials` — Extract standardized XBRL financial data
- `search_filings` — Full-text search across filings
- `get_insider_transactions` — Get insider trading data (Form 4)

## Process Management
- Supervised by `agentii serve` inside the VM
- Auto-restart on crash (monitored every 30s)
- Health check: `pgrep -f edgar.ai`
- Logs to `~/.agentii/logs/edgartools-mcp.log`
