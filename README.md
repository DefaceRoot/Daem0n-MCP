# Daem0nMCP

**AI Memory & Decision System** - Give AI agents persistent memory and consistent decision-making with *actual* semantic understanding.

## What's New in v2.1

- **TF-IDF Semantic Search**: Real similarity matching, not just keyword overlap
- **Memory Decay**: Recent memories weighted higher than old ones
- **Conflict Detection**: Warns when new decisions contradict past failures
- **Failed Decision Boosting**: Past mistakes surface prominently in recalls
- **Smart Briefing**: Pre-fetch context for focus areas
- **Context Check**: Combined recall + rules check in one call

## Why Daem0nMCP?

AI agents start each session fresh. They don't remember:
- What decisions were made and why
- Patterns that should be followed
- Warnings from past mistakes

**Markdown files don't solve this** - the AI has to know to read them and might ignore them.

**Daem0nMCP provides ACTIVE memory** - it surfaces relevant context when the AI asks about a topic, enforces rules before actions, and learns from outcomes.

### What Makes This Different

Unlike keyword-based systems:
- **Semantic matching**: "creating REST endpoint" matches rules about "adding API route"
- **Time decay**: A decision from yesterday matters more than one from 6 months ago
- **Conflict warnings**: "You tried this approach before and it failed"
- **Learning loops**: Record outcomes, and failures get boosted in future recalls

## Quick Start

```bash
# Install
pip install -e /path/to/Daem0n-MCP

# Run the MCP server
python -m daem0nmcp.server
```

## Core Tools

### 1. `remember` - Store a memory (with conflict detection)
```python
remember(
    category="decision",  # decision, pattern, warning, or learning
    content="Use JWT tokens instead of sessions",
    rationale="Need stateless auth for horizontal scaling",
    tags=["auth", "architecture"]
)
# Returns: memory ID, plus any conflict warnings
```

### 2. `recall` - Semantic memory retrieval
```python
recall("authentication")
# Returns: decisions, patterns, warnings, learnings about auth
# Sorted by: semantic relevance × recency × importance
```

### 3. `add_rule` - Create decision tree nodes
```python
add_rule(
    trigger="adding new API endpoint",
    must_do=["Add rate limiting", "Write integration test"],
    must_not=["Use synchronous database calls"],
    ask_first=["Is this a breaking change?"]
)
```

### 4. `check_rules` - Semantic rule matching
```python
check_rules("creating a new REST route")
# Matches rules about "API endpoints" via semantic similarity
# Returns: combined must_do, must_not, warnings
```

### 5. `record_outcome` - Learn from results
```python
record_outcome(memory_id=42, outcome="JWT auth works great", worked=True)
record_outcome(memory_id=43, outcome="Caching caused stale data", worked=False)
# Failed decisions get boosted in future recalls
```

### 6. `get_briefing` - Smart session start
```python
get_briefing(focus_areas=["authentication", "API"])
# Returns: stats, recent decisions, warnings, failed approaches,
# plus pre-fetched context for focus areas
```

### 7. `context_check` - Quick pre-flight check
```python
context_check("modifying the user authentication flow")
# Combines recall + check_rules in one call
# Returns: relevant memories, matching rules, all warnings
```

## MCP Configuration

### Claude Desktop / Claude Code
Add to your config file:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "daem0nmcp": {
      "command": "python",
      "args": ["-m", "daem0nmcp.server"],
      "env": {
        "PYTHONPATH": "/path/to/Daem0n-MCP",
        "DAEM0NMCP_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## AI Agent Protocol

### At Session Start
```
Call get_briefing(focus_areas=["what", "you're", "working on"])
```

### Before Making Changes
```
Call context_check("description of what you're doing")
# Or for detailed info:
Call recall(topic) and check_rules(action) separately
```

### When Making Decisions
```
Call remember(category="decision", content="...", rationale="...")
```

### After Implementing
```
Call record_outcome(memory_id, outcome, worked)
# Failures are especially valuable - they become warnings
```

## How It Works

### TF-IDF Similarity
Instead of simple keyword matching, Daem0nMCP builds TF-IDF vectors for all stored memories and queries. This means:
- "authentication" matches memories about "auth", "login", "OAuth"
- Rare terms (like project-specific names) get higher weight
- Common words are automatically de-emphasized

### Memory Decay
```
weight = e^(-λt) where λ = ln(2)/half_life_days
```
Default half-life is 30 days. A 60-day-old memory has ~25% weight.
Minimum weight floor prevents total loss of old context.

### Conflict Detection
When storing a new memory, it's compared against recent memories:
- If similar content failed before → warning about the failure
- If it matches an existing warning → warning surfaced
- If highly similar content exists → potential duplicate flagged

### Failed Decision Boosting
Memories with `worked=False` get a 1.5x relevance boost in recalls.
Warnings get a 1.2x boost. This ensures past mistakes surface prominently.

## Data Storage

Each project gets isolated storage at:
```
<project_root>/.daem0nmcp/storage/daem0nmcp.db
```

## Configuration

Environment variables (prefix: `DAEM0NMCP_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DAEM0NMCP_PROJECT_ROOT` | `.` | Project root path |
| `DAEM0NMCP_STORAGE_PATH` | auto | Override storage location |
| `DAEM0NMCP_LOG_LEVEL` | `INFO` | Logging level |

## Architecture

```
daem0nmcp/
├── server.py      # MCP server with 11 tools
├── memory.py      # Memory storage & semantic retrieval
├── rules.py       # Rule engine with TF-IDF matching
├── similarity.py  # TF-IDF index, decay, conflict detection
├── database.py    # SQLite async database
├── models.py      # 2 tables: memories, rules
└── config.py      # Pydantic settings
```

## Development

```bash
# Install in development mode
pip install -e .

# Run tests (53 tests)
pytest tests/ -v --asyncio-mode=auto

# Run server directly
python -m daem0nmcp.server
```

---

*Daem0nMCP: Because AI agents should remember what they learned—and what went wrong.*
