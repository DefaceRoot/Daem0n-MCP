# Automatic Memory Capture Setup

This guide explains how to set up Daem0n-MCP for fully automatic memory capture in OpenCode.

## Overview

Daem0n-MCP provides three layers of automatic memory capture:

1. **AGENTS.md Instructions** - AI reads and follows the protocol automatically
2. **OpenCode Plugin** - Hooks that inject context and extract decisions
3. **MCP Server Enforcement** - Blocks mutating operations until protocol is followed

## Quick Setup

### 1. Start the MCP Server

On Windows (required - uses HTTP transport):
```bash
start_daem0nmcp_server.bat
```

Or manually:
```bash
python start_server.py --port 9876
```

### 2. Configure OpenCode

Your `opencode.json` should look like:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "daem0nmcp": {
      "type": "remote",
      "url": "http://localhost:9876/mcp",
      "enabled": true
    }
  },
  "plugin": [
    "file://.opencode/plugin/daem0nmcp/dist/index.js"
  ],
  "permission": {
    "skill": {
      "daem0nmcp-protocol": "allow"
    }
  }
}
```

### 3. Build the Plugin (if not already built)

```bash
cd .opencode/plugin/daem0nmcp
npm install
npx tsc
```

### 4. Restart OpenCode

After configuration, restart OpenCode to load the plugin and MCP server.

## What Gets Captured Automatically

### At Session Start
- Plugin outputs a reminder to call `get_briefing()`
- AGENTS.md instructs AI to call `get_briefing()` first

### Before File Edits
- Plugin injects relevant memories for the file being edited
- Warnings about failed approaches are highlighted
- Must-do and must-not rules are shown

### After Significant Changes
- Plugin suggests calling `remember()` for significant edits
- Patterns detected: class definitions, API endpoints, config changes

### At Task Completion
- Plugin detects completion signals in AI responses
- Auto-extracts decisions from conversation text
- Creates memories automatically with "auto-captured" rationale
- Reminds to call `record_outcome()` for tracked decisions

## How Each Layer Works

### Layer 1: AGENTS.md Instructions

The `AGENTS.md` file in your project root contains explicit instructions for AI agents:

```markdown
## MANDATORY: Session Start (FIRST ACTION)

Before doing ANYTHING else in a new session, call:
daem0nmcp_get_briefing(project_path="<current_working_directory>")
```

This works because OpenCode reads AGENTS.md and includes it in the AI's context.

### Layer 2: OpenCode Plugin Hooks

The plugin provides these hooks:

| Hook | Trigger | Action |
|------|---------|--------|
| `session.created` | New session starts | Output communion reminder |
| `tool.execute.before` | Before Edit/Write | Inject file memories, check gates |
| `tool.execute.after` | After MCP calls | Track briefing/context_check state |
| `session.idle` | AI finishes response | Extract decisions, remind outcomes |
| `experimental.session.compacting` | Context compression | Preserve covenant state |

### Layer 3: MCP Server Enforcement

The Daem0n-MCP server itself enforces the protocol:

- **Communion Required**: Mutating tools return `COMMUNION_REQUIRED` until `get_briefing()` is called
- **Counsel Required**: Destructive operations require `context_check()` first
- **Preflight Tokens**: `context_check()` returns a 5-minute token proving consultation

## Verification

### Check MCP Server Health
```
daem0nmcp_health(project_path="...")
```

Should return `"status": "healthy"`.

### Check Briefing Works
```
daem0nmcp_get_briefing(project_path="...")
```

Should return statistics, warnings, and recent decisions.

### Check Plugin Loaded

Look for `[Daem0nMCP] Plugin initialized for: ...` in OpenCode logs at startup.

## Troubleshooting

### Plugin Not Loading

1. Check path in `opencode.json` is correct
2. Ensure plugin is compiled: `cd .opencode/plugin/daem0nmcp && npx tsc`
3. Check for TypeScript errors in compilation output

### MCP Server Not Responding

1. Verify server is running: check terminal for daemon ASCII art
2. Check URL in opencode.json matches server port
3. Test with: `curl http://localhost:9876/mcp`

### Memories Not Being Captured

1. Ensure `get_briefing()` was called (required for other operations)
2. Check AGENTS.md is in project root
3. Verify skill is allowed in opencode.json permissions

## Manual Fallback

If automatic capture isn't working, manually invoke the protocol:

```python
# Start of session
daem0nmcp_get_briefing(project_path="...")

# Before changes
daem0nmcp_context_check(description="...", project_path="...")
daem0nmcp_recall_for_file(file_path="...", project_path="...")

# After decisions
result = daem0nmcp_remember(category="...", content="...", project_path="...")

# After implementation
daem0nmcp_record_outcome(memory_id=result.id, outcome="...", worked=True, project_path="...")
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        OpenCode                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  AGENTS.md  │  │   Plugin    │  │    MCP Client       │  │
│  │ (Protocol   │  │  (Hooks &   │  │  (Tool Calls)       │  │
│  │  Instructions)│  │ Enforcement)│  │                     │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
│                                                │              │
└────────────────────────────────────────────────┼──────────────┘
                                                 │ HTTP
                                                 ▼
                                   ┌─────────────────────────┐
                                   │   Daem0n-MCP Server     │
                                   │  (Port 9876)            │
                                   │                         │
                                   │  - Memory Storage       │
                                   │  - Semantic Search      │
                                   │  - Rule Engine          │
                                   │  - Outcome Tracking     │
                                   │  - Code Understanding   │
                                   └─────────────────────────┘
```

## Next Steps

1. Start a new OpenCode session in your project
2. The AI should automatically call `get_briefing()`
3. Make some decisions and watch them get captured
4. Start another session and verify past decisions are recalled
