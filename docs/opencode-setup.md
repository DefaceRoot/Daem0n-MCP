# OpenCode Setup for Daem0n-MCP (Windows)

This guide covers setting up Daem0n-MCP with OpenCode on Windows.

## Prerequisites

- Python 3.10+
- OpenCode installed
- Daem0n-MCP installed (`pip install -e ~/Daem0nMCP`)

## Step 1: Start the MCP Server

Daem0n-MCP uses HTTP transport on Windows (stdio has known issues).

### Option A: Use the batch file
```cmd
start_daem0nmcp_server.bat
```

### Option B: Start manually
```cmd
python start_server.py --port 9876
```

Keep this terminal open while using OpenCode.

## Step 2: Configure OpenCode

The `opencode.json` file should already exist in the project root:

```json
{
  "mcp": {
    "daem0nmcp": {
      "type": "remote",
      "url": "http://localhost:9876/mcp"
    }
  }
}
```

## Step 3: Verify Connection

1. Start OpenCode: `opencode`
2. Test the connection:
```
mcp__daem0nmcp__health()
```

You should see:
```json
{
  "status": "healthy",
  "version": "2.15.0",
  ...
}
```

## Step 4: First-Time Setup

On first use in a new project:

1. Call `get_briefing()` - This bootstraps the project context
2. The Daem0n creates 6-7 memories from your project structure

```
mcp__daem0nmcp__get_briefing()
```

## Plugin Features

The OpenCode plugin provides:

### Covenant Enforcement
- Blocks mutating tools until `get_briefing()` is called
- Requires `context_check()` before destructive operations
- 5-minute TTL on context checks

### Pre-Edit Memory Injection
Before editing files, the plugin automatically:
- Recalls memories linked to that file
- Shows warnings, failed approaches, patterns
- Displays must_do / must_not rules

### Post-Edit Suggestions
After significant changes, the plugin suggests:
- Calling `remember()` to capture the decision
- What category to use (decision, pattern, warning, learning)

### Decision Auto-Extraction
When tasks complete, the plugin:
- Detects completion signals
- Extracts decisions from responses
- Auto-creates memories
- Reminds to record outcomes

## Troubleshooting

### "Cannot connect to MCP server"
- Ensure the server is running: `python start_server.py --port 9876`
- Check firewall isn't blocking localhost:9876

### "Tool blocked - communion required"
- Call `mcp__daem0nmcp__get_briefing()` first
- This is the covenant requirement

### "Counsel expired"
- Your `context_check()` is older than 5 minutes
- Call `mcp__daem0nmcp__context_check()` again

### No memories appearing before edits
- Ensure `get_briefing()` was called (briefed = true)
- Check if the file has associated memories

## Directory Structure

```
.opencode/
├── plugin/
│   └── daem0nmcp/
│       ├── index.ts        # Main plugin entry
│       ├── covenant.ts     # Enforcement logic
│       ├── types.ts        # TypeScript definitions
│       ├── hooks/
│       │   ├── session.ts      # Session lifecycle
│       │   ├── pre-edit.ts     # Memory injection
│       │   ├── post-edit.ts    # Significance detection
│       │   └── extraction.ts   # Decision extraction
│       └── utils/
│           ├── mcp-client.ts   # HTTP MCP client
│           └── patterns.ts     # Regex patterns
└── skill/
    └── daem0nmcp-protocol/
        └── SKILL.md            # Protocol skill

opencode.json                   # MCP server config
AGENTS.md                       # Protocol summary
```

## Quick Reference

```typescript
// Session start
mcp__daem0nmcp__get_briefing()

// Before changes
mcp__daem0nmcp__context_check({ description: "Adding auth to API" })

// Record decisions
mcp__daem0nmcp__remember({
  category: "decision",
  content: "Using JWT for stateless auth",
  rationale: "Need horizontal scaling",
  file_path: "src/auth/jwt.ts"
})

// Record outcomes
mcp__daem0nmcp__record_outcome({
  memory_id: 42,
  outcome: "JWT auth working in production",
  worked: true
})
```
