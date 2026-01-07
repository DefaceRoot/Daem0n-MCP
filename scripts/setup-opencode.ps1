#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sets up Daem0n-MCP with OpenCode on Windows

.DESCRIPTION
    This script:
    1. Installs the Daem0n-MCP Python package
    2. Sets up the OpenCode plugin
    3. Configures MCP server connection
    4. Copies required files to your project

.PARAMETER ProjectPath
    Target project directory to configure (defaults to current directory)

.PARAMETER Daem0nPath
    Path to Daem0n-MCP repository (defaults to ~/Daem0nMCP)

.PARAMETER Port
    MCP server port (defaults to 9876)

.EXAMPLE
    ./setup-opencode.ps1 -ProjectPath "C:\Projects\MyProject"
#>

param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$Daem0nPath = "$env:USERPROFILE\Daem0nMCP",
    [int]$Port = 9876
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Daem0n-MCP OpenCode Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python not found. Please install Python 3.10+" -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check if Daem0n-MCP exists
$RepoUrl = "https://github.com/DefaceRoot/Daem0n-MCP.git"
if (-not (Test-Path $Daem0nPath)) {
    Write-Host "  Daem0n-MCP not found at $Daem0nPath" -ForegroundColor Yellow
    Write-Host "  Cloning from GitHub fork..." -ForegroundColor Yellow
    git clone $RepoUrl $Daem0nPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to clone repository" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Daem0n-MCP found at: $Daem0nPath" -ForegroundColor Green
    # Pull latest
    Push-Location $Daem0nPath
    Write-Host "  Pulling latest changes..." -ForegroundColor Yellow
    git pull
    Pop-Location
}

# Step 2: Install Python package
Write-Host ""
Write-Host "[2/6] Installing Daem0n-MCP Python package..." -ForegroundColor Yellow
Push-Location $Daem0nPath
pip install -e . --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Failed to install Python package" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  Package installed successfully" -ForegroundColor Green
Pop-Location

# Step 3: Setup OpenCode plugin
Write-Host ""
Write-Host "[3/6] Setting up OpenCode plugin..." -ForegroundColor Yellow

$pluginSource = Join-Path $Daem0nPath ".opencode\plugin\daem0nmcp"
$skillSource = Join-Path $Daem0nPath ".opencode\skill"

if (Test-Path $pluginSource) {
    # Create .opencode directory in project
    $projectOpencode = Join-Path $ProjectPath ".opencode"
    $projectPlugin = Join-Path $projectOpencode "plugin\daem0nmcp"
    $projectSkill = Join-Path $projectOpencode "skill"
    
    # Create directories
    New-Item -ItemType Directory -Force -Path $projectPlugin | Out-Null
    New-Item -ItemType Directory -Force -Path $projectSkill | Out-Null
    
    # Copy plugin files (excluding node_modules)
    Write-Host "  Copying plugin source files..." -ForegroundColor Yellow
    Get-ChildItem -Path $pluginSource -Exclude "node_modules","dist" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $projectPlugin -Recurse -Force
    }
    
    # Copy skill files
    if (Test-Path $skillSource) {
        Write-Host "  Copying skill files..." -ForegroundColor Yellow
        Copy-Item -Path "$skillSource\*" -Destination $projectSkill -Recurse -Force
    }
    
    # Install dependencies and build
    Write-Host "  Installing plugin dependencies..." -ForegroundColor Yellow
    Push-Location $projectPlugin
    
    # Check for bun first, fall back to npm
    $useBun = $false
    try {
        $bunVersion = bun --version 2>&1
        $useBun = $true
        Write-Host "  Using bun: $bunVersion" -ForegroundColor Green
    } catch {
        Write-Host "  Using npm (bun not found)" -ForegroundColor Yellow
    }
    
    if ($useBun) {
        bun install
    } else {
        npm install
    }
    
    # Build TypeScript
    Write-Host "  Building plugin..." -ForegroundColor Yellow
    npx tsc
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: TypeScript build had issues, but may still work" -ForegroundColor Yellow
    } else {
        Write-Host "  Plugin built successfully" -ForegroundColor Green
    }
    
    Pop-Location
} else {
    Write-Host "  WARNING: Plugin source not found at $pluginSource" -ForegroundColor Yellow
    Write-Host "  You may need to manually copy the plugin files" -ForegroundColor Yellow
}

# Step 4: Create opencode.json
Write-Host ""
Write-Host "[4/6] Creating opencode.json..." -ForegroundColor Yellow

$opencodeJson = Join-Path $ProjectPath "opencode.json"
$opencodeConfig = @{
    '$schema' = "https://opencode.ai/config.json"
    plugin = @("file://.opencode/plugin/daem0nmcp/dist/index.js")
    mcp = @{
        daem0nmcp = @{
            type = "remote"
            url = "http://localhost:$Port/mcp"
            enabled = $true
        }
    }
    permission = @{
        skill = @{
            "daem0nmcp-protocol" = "allow"
        }
    }
}

$opencodeConfig | ConvertTo-Json -Depth 10 | Set-Content $opencodeJson -Encoding UTF8
Write-Host "  Created: $opencodeJson" -ForegroundColor Green

# Step 5: Copy AGENTS.md
Write-Host ""
Write-Host "[5/6] Setting up agent instructions..." -ForegroundColor Yellow

$agentsMdSource = Join-Path $Daem0nPath "AGENTS.md"
$agentsMdDest = Join-Path $ProjectPath "AGENTS.md"

if (Test-Path $agentsMdSource) {
    if (-not (Test-Path $agentsMdDest)) {
        Copy-Item -Path $agentsMdSource -Destination $agentsMdDest
        Write-Host "  Created: $agentsMdDest" -ForegroundColor Green
    } else {
        Write-Host "  AGENTS.md already exists, skipping" -ForegroundColor Yellow
    }
} else {
    Write-Host "  WARNING: AGENTS.md not found in source" -ForegroundColor Yellow
}

# Step 6: Create start script
Write-Host ""
Write-Host "[6/6] Creating server start script..." -ForegroundColor Yellow

$startScript = Join-Path $ProjectPath "start-daem0n-server.bat"
$startScriptContent = @"
@echo off
echo Starting Daem0n-MCP Server on port $Port...
python "$Daem0nPath\start_server.py" --port $Port
pause
"@

$startScriptContent | Set-Content $startScript -Encoding ASCII
Write-Host "  Created: $startScript" -ForegroundColor Green

# Done!
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To use Daem0n-MCP with OpenCode:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start the MCP server (keep terminal open):" -ForegroundColor White
Write-Host "   $startScript" -ForegroundColor Yellow
Write-Host "   OR: python $Daem0nPath\start_server.py --port $Port" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. In another terminal, start OpenCode:" -ForegroundColor White
Write-Host "   cd $ProjectPath" -ForegroundColor Yellow
Write-Host "   opencode" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. The AI will automatically:" -ForegroundColor White
Write-Host "   - Call get_briefing() at session start" -ForegroundColor Gray
Write-Host "   - Show warnings before editing files" -ForegroundColor Gray
Write-Host "   - Suggest recording decisions" -ForegroundColor Gray
Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Write-Host "  - $opencodeJson" -ForegroundColor Gray
Write-Host "  - $projectOpencode\" -ForegroundColor Gray
Write-Host "  - $startScript" -ForegroundColor Gray
if (Test-Path $agentsMdDest) {
    Write-Host "  - $agentsMdDest" -ForegroundColor Gray
}
Write-Host ""
