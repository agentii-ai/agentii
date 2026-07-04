#!/usr/bin/env bash
# Build the Agentii sandbox VM image.
# Creates a Lima VM from the template, provisions runtimes, installs
# the PTY broker daemon, edgartools-mcp, and context-gen watcher.
#
# Usage: ./build-vm-image.sh [--name agentii-base]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VM_NAME="${1:-agentii-base}"
TEMPLATE="$SCRIPT_DIR/agentii-vm.yaml"

echo "==> Building Agentii VM image: $VM_NAME"

# Check Lima is installed
if ! command -v limactl &>/dev/null; then
  echo "ERROR: limactl not found. Install Lima: brew install lima" >&2
  exit 1
fi

# Delete existing VM if present
if limactl list --json "$VM_NAME" 2>/dev/null | grep -q "$VM_NAME"; then
  echo "==> Removing existing VM: $VM_NAME"
  limactl stop "$VM_NAME" 2>/dev/null || true
  limactl delete --force "$VM_NAME"
fi

# Create VM from template
echo "==> Creating VM from template"
limactl create --name "$VM_NAME" "$TEMPLATE" --cpus 2 --memory 2GiB

# Start VM
echo "==> Starting VM"
limactl start "$VM_NAME"

# Install PTY broker daemon
echo "==> Installing PTY broker daemon"
limactl shell "$VM_NAME" -- sudo mkdir -p /opt/agentii/bin
limactl shell "$VM_NAME" -- sudo tee /opt/agentii/bin/pty-broker.py < "$REPO_ROOT/scripts/vm/pty-broker.py" > /dev/null
limactl shell "$VM_NAME" -- sudo chmod +x /opt/agentii/bin/pty-broker.py

# Install PTY broker systemd service
cat <<'SERVICE' | limactl shell "$VM_NAME" -- sudo tee /etc/systemd/system/agentii-pty-broker.service > /dev/null
[Unit]
Description=Agentii PTY Broker Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/agentii/bin/pty-broker.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
SERVICE
limactl shell "$VM_NAME" -- sudo systemctl daemon-reload
limactl shell "$VM_NAME" -- sudo systemctl enable agentii-pty-broker

# Install edgartools-mcp
echo "==> Installing edgartools-mcp"
limactl shell "$VM_NAME" -- sudo mkdir -p /opt/agentii/mcp-servers/edgartools-mcp
limactl shell "$VM_NAME" -- bash -c "cd /opt/agentii/mcp-servers/edgartools-mcp && python3 -m venv .venv"
# Copy MCP server files
tar -C "$REPO_ROOT/mcp-servers/edgartools-mcp" -cf - . | limactl shell "$VM_NAME" -- tar -C /opt/agentii/mcp-servers/edgartools-mcp -xf -
limactl shell "$VM_NAME" -- bash -c "cd /opt/agentii/mcp-servers/edgartools-mcp && .venv/bin/pip install -e ." || echo "WARN: edgartools-mcp pip install failed (expected if offline)"

# Install edgartools-mcp systemd service
cat <<'SERVICE' | limactl shell "$VM_NAME" -- sudo tee /etc/systemd/system/edgartools-mcp.service > /dev/null
[Unit]
Description=Agentii edgartools MCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/agentii/mcp-servers/edgartools-mcp
ExecStart=/opt/agentii/mcp-servers/edgartools-mcp/.venv/bin/python -m edgar.ai
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SERVICE
limactl shell "$VM_NAME" -- sudo systemctl daemon-reload
limactl shell "$VM_NAME" -- sudo systemctl enable edgartools-mcp

# Install context-gen watcher
echo "==> Installing context-gen watcher"
limactl shell "$VM_NAME" -- sudo mkdir -p /opt/agentii/context-gen
tar -C "$REPO_ROOT/scripts/context-gen" -cf - . | limactl shell "$VM_NAME" -- tar -C /opt/agentii/context-gen -xf -
limactl shell "$VM_NAME" -- bash -c "pip3 install watchdog jinja2 pyyaml 2>/dev/null || true"

# Install context-gen watcher systemd service
cat <<'SERVICE' | limactl shell "$VM_NAME" -- sudo tee /etc/systemd/system/agentii-context-watcher.service > /dev/null
[Unit]
Description=Agentii Context File Watcher
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/agentii/context-gen/watcher.py /workspace
Restart=always
RestartSec=2
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SERVICE
limactl shell "$VM_NAME" -- sudo systemctl daemon-reload
limactl shell "$VM_NAME" -- sudo systemctl enable agentii-context-watcher

# Verify installations
echo "==> Verifying installations"
limactl shell "$VM_NAME" -- node --version
limactl shell "$VM_NAME" -- python3 --version
limactl shell "$VM_NAME" -- bun --version 2>/dev/null || echo "bun: not installed yet"
limactl shell "$VM_NAME" -- uv --version 2>/dev/null || echo "uv: not installed yet"

# Report image size
echo "==> VM image ready: $VM_NAME"
limactl list "$VM_NAME"

echo "==> Done. Stop with: limactl stop $VM_NAME"
