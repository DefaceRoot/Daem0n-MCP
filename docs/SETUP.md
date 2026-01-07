# Daem0n-MCP Setup Guide

Complete setup guide for Daem0n-MCP with OpenCode on Windows.

---

## Overview

Daem0n-MCP provides persistent AI memory with automatic memory capture. After setup:

- **Auto-briefing**: AI receives project context on session start
- **Auto-warnings**: Relevant memories injected before file edits
- **Auto-remember**: Significant changes captured automatically
- **Auto-outcomes**: Test/build results recorded as outcomes

No manual intervention required - it's fully fire-and-forget.

---

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| OpenCode | Latest | `opencode --version` |
| Git | Any | `git --version` |

---

## Installation

### Step 1: Clone Repository (One-Time)

Choose a permanent location for the Daem0n-MCP repository:

```powershell
# Clone to your home directory (recommended)
git clone https://github.com/DefaceRoot/Daem0n-MCP.git ~/Daem0nMCP

# Or clone to a custom location
git clone https://github.com/DefaceRoot/Daem0n-MCP.git C:\Tools\Daem0nMCP
```

### Step 2: Install Python Package (One-Time)

```powershell
# Install in development mode (allows easy updates)
pip install -e ~/Daem0nMCP
```

### Step 3: Setup Your Project (Per-Project)

Navigate to your project directory and run the setup script:

```powershell
# Go to your project
cd C:\Projects\MyProject

# Run the setup script
~/Daem0nMCP/scripts/setup-opencode.ps1
```

**What the script does:**

1. Verifies prerequisites (Python, Node.js)
2. Pulls latest Daem0n-MCP updates
3. Copies plugin to `.opencode/plugin/daem0nmcp/`
4. Installs npm dependencies
5. Builds TypeScript plugin
6. Creates `opencode.json` configuration
7. Copies `AGENTS.md` protocol instructions
8. Creates `start-daem0n-server.bat` launcher

---

## Usage

### Starting a Session

**Terminal 1** - Start the MCP server (keep this open):

```powershell
# Option A: Use the generated batch file
.\start-daem0n-server.bat

# Option B: Run manually
python ~/Daem0nMCP/start_server.py --port 9876
```

**Terminal 2** - Start OpenCode:

```powershell
cd C:\Projects\MyProject
opencode
```

### What Happens Automatically

| Event | Automatic Action |
|-------|------------------|
| Session starts | `get_briefing()` called, digest injected |
| Before file edit | Warnings and patterns shown |
| After significant edit | Memory created automatically |
| Task completion | Decisions extracted and saved |
| Tests pass/fail | Outcomes recorded automatically |

---

## Files Created in Your Project

```
YourProject/
├── .opencode/
│   └── plugin/
│       └── daem0nmcp/
│           ├── dist/           # Compiled plugin (JS)
│           ├── hooks/          # TypeScript source
│           ├── utils/          # Helper modules
│           ├── package.json    # Plugin dependencies
│           └── tsconfig.json   # TypeScript config
├── .daem0nmcp/
│   └── storage/
│       └── daem0nmcp.db        # Memory database (created on first use)
├── opencode.json               # MCP + plugin configuration
├── AGENTS.md                   # Protocol instructions for AI
└── start-daem0n-server.bat     # Server launcher
```

---

## Configuration

### opencode.json

The setup script creates this configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file://.opencode/plugin/daem0nmcp/dist/index.js"],
  "mcp": {
    "daem0nmcp": {
      "type": "remote",
      "url": "http://localhost:9876/mcp",
      "enabled": true
    }
  },
  "permission": {
    "skill": {
      "daem0nmcp-protocol": "allow"
    }
  }
}
```

### Custom Port

To use a different port:

```powershell
# Run setup with custom port
~/Daem0nMCP/scripts/setup-opencode.ps1 -Port 8080

# Start server on that port
python ~/Daem0nMCP/start_server.py --port 8080
```

### Custom Daem0n-MCP Location

If you cloned to a different location:

```powershell
~/Daem0nMCP/scripts/setup-opencode.ps1 -Daem0nPath "C:\Tools\Daem0nMCP"
```

---

## Updating

### Update Daem0n-MCP

```powershell
cd ~/Daem0nMCP
git pull
pip install -e .
```

### Update Project Plugin

Re-run the setup script in your project:

```powershell
cd C:\Projects\MyProject
~/Daem0nMCP/scripts/setup-opencode.ps1
```

---

## Verification

### Check Server Health

With the server running, in OpenCode:

```
mcp__daem0nmcp__health()
```

Expected output:
```json
{
  "status": "healthy",
  "version": "2.15.0",
  "project_path": "C:\\Projects\\MyProject"
}
```

### Check Plugin Loaded

Look for this in OpenCode startup logs:
```
[Daem0nMCP] Plugin initialized for: C:\Projects\MyProject
[Daem0nMCP] Server online: 2.15.0
```

### Test Auto-Briefing

Start a new OpenCode session. You should see:
```
[Daem0n briefed] Session initialized...
```

---

## Troubleshooting

### "Cannot connect to MCP server"

1. Ensure the server is running in Terminal 1
2. Check the port matches (default: 9876)
3. Verify firewall isn't blocking localhost

```powershell
# Test server directly
curl http://localhost:9876/mcp
```

### "Plugin not loading"

1. Verify the plugin was built:
   ```powershell
   ls .opencode/plugin/daem0nmcp/dist/index.js
   ```

2. Rebuild if needed:
   ```powershell
   cd .opencode/plugin/daem0nmcp
   npm run build
   ```

### "Tool blocked - communion required"

This is expected behavior. The plugin auto-calls `get_briefing()` on session start. If you see this:

1. The server might have been offline when the session started
2. Manually call: `mcp__daem0nmcp__get_briefing()`

### Server Offline Mode

If the server is unavailable, the plugin:
- Logs once: "Daem0n server unreachable; memory automation disabled"
- Allows all operations (no blocking)
- Does not spam repeated connection attempts

---

## Quick Reference

### Manual MCP Tool Calls

```typescript
// Session start (auto-called by plugin)
mcp__daem0nmcp__get_briefing()

// Before changes (auto-called by plugin)
mcp__daem0nmcp__context_check({ description: "Adding auth to API" })

// Record a decision manually
mcp__daem0nmcp__remember({
  category: "decision",
  content: "Using JWT for stateless auth",
  rationale: "Need horizontal scaling",
  file_path: "src/auth/jwt.ts"
})

// Record outcome manually
mcp__daem0nmcp__record_outcome({
  memory_id: 42,
  outcome: "JWT auth working in production",
  worked: true
})
```

### Memory Categories

| Category | Use For | Persistence |
|----------|---------|-------------|
| `decision` | Architecture/design choices | Decays over 30 days |
| `pattern` | Conventions to follow | Permanent |
| `warning` | Things to avoid | Permanent |
| `learning` | Lessons from experience | Decays over 30 days |

---

## Summary

| Step | Command | Frequency |
|------|---------|-----------|
| Clone repo | `git clone ... ~/Daem0nMCP` | Once per computer |
| Install Python | `pip install -e ~/Daem0nMCP` | Once per computer |
| Setup project | `~/Daem0nMCP/scripts/setup-opencode.ps1` | Once per project |
| Start server | `.\start-daem0n-server.bat` | Every session |
| Start OpenCode | `opencode` | Every session |

**The setup script is run FROM your project directory, not from the Daem0n-MCP repository.**

---

## See Also

- [Multi-Repo Setup](multi-repo-setup.md) - Link related repositories
- [AGENTS.md](../AGENTS.md) - Protocol instructions for AI agents
- [README.md](../README.md) - Full feature documentation
