# Daem0n-MCP + OpenCode Quick Start

## One-Time Setup

```powershell
git clone https://github.com/DefaceRoot/Daem0n-MCP.git ~/Daem0nMCP
pip install -e ~/Daem0nMCP
```

## Per-Project Setup

In your project directory, create `opencode.json`:

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

## Usage

**Terminal 1** - Start server (keep open):
```powershell
python ~/Daem0nMCP/start_server.py --port 9876
```

**Terminal 2** - Run OpenCode:
```powershell
opencode
```

## Verify

In OpenCode, the AI should automatically call `get_briefing()` on session start. You can also test manually:
```
daem0nmcp_health()
```

## Notes

- Memories are stored in `<project>/.daem0nmcp/` (per-project isolation)
- Server must be running before starting OpenCode
- Copy `AGENTS.md` to your project for automatic protocol enforcement (optional)
