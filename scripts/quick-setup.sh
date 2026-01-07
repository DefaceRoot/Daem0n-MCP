#!/bin/bash
# Quick setup for Daem0n-MCP with OpenCode (Linux/Mac)
# Run this in your PROJECT directory

PORT=${1:-9876}
DAEM0N_PATH="$HOME/Daem0nMCP"
REPO_URL="https://github.com/DefaceRoot/Daem0n-MCP.git"

# Clone if needed
if [ ! -d "$DAEM0N_PATH" ]; then
    echo "Cloning Daem0n-MCP from fork..."
    git clone "$REPO_URL" "$DAEM0N_PATH"
fi

# Install Python package
echo "Installing Python package..."
pip install -e "$DAEM0N_PATH" --quiet

# Create opencode.json
cat > opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "mcp": {
    "daem0nmcp": {
      "type": "remote",
      "url": "http://localhost:$PORT/mcp",
      "enabled": true
    }
  }
}
EOF
echo "Created opencode.json"

# Copy AGENTS.md
if [ -f "$DAEM0N_PATH/AGENTS.md" ]; then
    cp "$DAEM0N_PATH/AGENTS.md" .
    echo "Copied AGENTS.md"
fi

echo ""
echo "Done! Now:"
echo "  1. Start server: python $DAEM0N_PATH/start_server.py --port $PORT"
echo "  2. Run OpenCode:  opencode"
