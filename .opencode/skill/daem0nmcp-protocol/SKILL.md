---
name: daem0nmcp-protocol
description: Use when Daem0nMCP tools are available - enforces the sacred covenant (commune at session start, seek counsel before changes, inscribe decisions, seal outcomes)
---

# The Daem0n's Protocol

## Overview

When Daem0nMCP memory tools are available, you MUST follow this protocol. Memory without discipline is noise.

**Core principle:** Check before you change, record what you decide, track whether it worked.

## Tool Detection

First, verify Daem0nMCP tools are available:

```
Look for these tools in your available tools:
- mcp__daem0nmcp__get_briefing
- mcp__daem0nmcp__context_check
- mcp__daem0nmcp__remember
- mcp__daem0nmcp__record_outcome
- mcp__daem0nmcp__link_memories
- mcp__daem0nmcp__trace_chain
- mcp__daem0nmcp__get_graph
- mcp__daem0nmcp__find_code
- mcp__daem0nmcp__analyze_impact
- mcp__daem0nmcp__index_project
```

**If tools are NOT available:** This skill does not apply. Proceed normally.

**If tools ARE available:** Follow the protocol below. No exceptions.

## The Protocol

### 1. SESSION START (Non-Negotiable)

```
IMMEDIATELY when you have daem0nmcp tools:

mcp__daem0nmcp__get_briefing()

DO NOT:
- Ask user what they want first
- Skip briefing because "it's a quick task"
- Assume you remember from last session
```

The briefing loads:
- Past decisions and their outcomes
- Warnings and failed approaches to AVOID
- Patterns to FOLLOW
- Git changes since last session

### 2. BEFORE ANY CODE CHANGES

```
BEFORE touching any file:

mcp__daem0nmcp__context_check(description="what you're about to do")

OR for specific files:

mcp__daem0nmcp__recall_for_file(file_path="path/to/file")
```

**If context_check returns:**
- **WARNING:** You MUST acknowledge it to the user
- **FAILED APPROACH:** Explain how your approach differs
- **must_not:** These are HARD CONSTRAINTS - do not violate

### 3. AFTER MAKING DECISIONS

```
AFTER every significant decision:

memory_result = mcp__daem0nmcp__remember(
    category="decision",  // or "pattern", "warning", "learning"
    content="What you decided",
    rationale="Why you decided it",
    file_path="relevant/file.py",  // optional
    tags=["relevant", "tags"]
)

SAVE THE MEMORY ID - you need it for record_outcome
```

**Category Guide:**
| Category | Use For | Persistence |
|----------|---------|-------------|
| decision | Architectural/design choices | Decays over 30 days |
| pattern | Recurring approaches to follow | PERMANENT |
| warning | Things to avoid | PERMANENT |
| learning | Lessons from experience | Decays over 30 days |

### 4. AFTER IMPLEMENTATION (Critical)

```
AFTER implementing and testing:

mcp__daem0nmcp__record_outcome(
    memory_id=<id from remember>,
    outcome="What actually happened",
    worked=true  // or false
)
```

**FAILURES ARE VALUABLE.** If something doesn't work:
- Record `worked=false` with explanation
- Failed approaches get 1.5x boost in future searches
- You WILL see past mistakes - that's the point

## Red Flags - STOP

- About to edit a file without calling `recall_for_file`
- Making a significant decision without calling `remember`
- Implementation complete but no `record_outcome` called
- Context check returned WARNING but you didn't acknowledge it
- Repeating an approach that previously failed

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "It's a small change" | Small changes compound into big problems |
| "I'll remember later" | You won't. Record now. |
| "Context check is overkill" | 5 seconds now vs hours debugging later |
| "The warning doesn't apply" | Warnings exist because someone failed before |
| "I don't need to record failures" | Failures are the most valuable memories |

## Enforcement

The Sacred Covenant is ENFORCED, not advisory:

### What Happens If You Skip Steps

1. **Skip get_briefing()**: ALL mutating tools return `COMMUNION_REQUIRED` block
2. **Skip context_check()**: Mutating tools return `COUNSEL_REQUIRED` block
3. **Each block includes a `remedy`**: The exact tool call to fix it

### Tool Classifications

**Require Counsel** (must call context_check first):
remember, remember_batch, add_rule, update_rule, prune_memories, cleanup_memories, compact_memories, import_data, ingest_doc

**Require Communion** (must call get_briefing first):
All above plus: record_outcome, link_memories, unlink_memories, pin_memory, archive_memory, rebuild_index, index_project

**Exempt** (always available):
get_briefing, health, context_check, recall, recall_for_file, search_memories, find_related, check_rules, list_rules, find_code, analyze_impact

### Preflight Token

After `context_check()`, you receive a `preflight_token` in the response.
This is cryptographic proof you consulted the Daem0n.
Token is valid for 5 minutes.

## Workflow Summary

```
SESSION START
    > get_briefing()

BEFORE CHANGES
    > context_check("what you're doing")
    > recall_for_file("path") for specific files
    > ACKNOWLEDGE any warnings

AFTER DECISIONS
    > remember(category, content, rationale)
    > SAVE the memory_id
    > link_memories() if causally related

AFTER IMPLEMENTATION
    > record_outcome(memory_id, outcome, worked)
```

## Graph Memory Tools

Memories can be explicitly linked to create a knowledge graph.

### Relationship Types

| Type | Meaning |
|------|---------|
| `led_to` | A caused/resulted in B |
| `supersedes` | A replaces B (B is outdated) |
| `depends_on` | A requires B to be valid |
| `conflicts_with` | A contradicts B |
| `related_to` | General association |

### Link Memories

```
mcp__daem0nmcp__link_memories(
    source_id=<memory_id>,
    target_id=<other_memory_id>,
    relationship="led_to",
    description="Optional context for the link"
)
```

### Trace Causal Chains

```
mcp__daem0nmcp__trace_chain(
    memory_id=<id>,
    direction="backward",  // "forward", "backward", or "both"
    max_depth=5
)
```

### Visualize the Graph

```
mcp__daem0nmcp__get_graph(
    memory_ids=[1, 2, 3],  // OR
    topic="authentication",
    format="mermaid"  // or "json"
)
```

## Code Intelligence Tools

**Index your codebase:**
```
mcp__daem0nmcp__index_project()
```

**Search code semantically:**
```
mcp__daem0nmcp__find_code(query="user authentication")
```

**Analyze change impact:**
```
mcp__daem0nmcp__analyze_impact(entity_name="UserService.authenticate")
```

## Condensed Mode for Large Projects

For projects with many memories, use condensed recall:

```
mcp__daem0nmcp__recall(topic="authentication", condensed=True)
```

Returns compressed output (~75% token reduction).

## The Bottom Line

**Memory tools exist. Use them correctly.**

Check context. Record decisions. Track outcomes. Link related memories.

This is non-negotiable when Daem0nMCP tools are available.
