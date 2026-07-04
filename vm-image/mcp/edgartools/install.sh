#!/bin/bash
# Install edgartools-mcp inside the VM
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing edgartools-mcp..."
pip install --quiet -r "$SCRIPT_DIR/requirements.txt"

echo "edgartools-mcp installed successfully"
echo "Start with: python -m edgar.ai"
