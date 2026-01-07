#!/usr/bin/env pwsh
# Quick setup for Daem0n-MCP with OpenCode (Windows)
# Run this in your PROJECT directory

param([int]$Port = 9876)

$Daem0nPath = "$env:USERPROFILE\Daem0nMCP"
$RepoUrl = "https://github.com/DefaceRoot/Daem0n-MCP.git"

# Clone if needed
if (-not (Test-Path $Daem0nPath)) {
    Write-Host "Cloning Daem0n-MCP from fork..." -ForegroundColor Yellow
    git clone $RepoUrl $Daem0nPath
}

# Install Python package
Write-Host "Installing Python package..." -ForegroundColor Yellow
pip install -e $Daem0nPath --quiet

# Create opencode.json in current directory
$config = @"
{
  "`$schema": "https://opencode.ai/config.json",
  "mcp": {
    "daem0nmcp": {
      "type": "remote",
      "url": "http://localhost:$Port/mcp",
      "enabled": true
    }
  }
}
"@
$config | Set-Content "opencode.json" -Encoding UTF8
Write-Host "Created opencode.json" -ForegroundColor Green

# Copy AGENTS.md (optional but recommended)
if (Test-Path "$Daem0nPath\AGENTS.md") {
    Copy-Item "$Daem0nPath\AGENTS.md" . -Force
    Write-Host "Copied AGENTS.md" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done! Now:" -ForegroundColor Cyan
Write-Host "  1. Start server: python $Daem0nPath\start_server.py --port $Port"
Write-Host "  2. Run OpenCode:  opencode"
