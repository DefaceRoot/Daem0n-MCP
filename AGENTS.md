# Agent Instructions

## CRITICAL: Automatic Memory Protocol

**This project has persistent AI memory via Daem0n-MCP. YOU MUST use it automatically.**

The memory system captures decisions, solutions, and bug fixes across sessions. **Do NOT wait for user instruction - execute the protocol automatically.**

---

## MANDATORY: Session Start (FIRST ACTION)

**Before doing ANYTHING else in a new session, call:**

```
daem0nmcp_get_briefing(project_path="<current_working_directory>")
```

This retrieves:
- Past decisions and their outcomes
- Warnings and failed approaches to AVOID
- Patterns to FOLLOW
- Git changes since last session

**If you skip this, you will repeat past mistakes.**

---

## MANDATORY: Before Any Code Changes

**Before editing ANY file, call:**

```
daem0nmcp_context_check(
    description="<what you're about to do>",
    project_path="<cwd>"
)
```

This checks for:
- Known warnings about the files you're touching
- Failed approaches you should avoid
- Rules and constraints to follow

**Also call `daem0nmcp_recall_for_file(file_path="...")` for specific files.**

---

## MANDATORY: Record Decisions Automatically

**After making ANY of these, call `daem0nmcp_remember()` IMMEDIATELY:**

1. **Architecture decisions** - choosing between approaches
2. **Bug fixes** - what the bug was and how you fixed it
3. **Solutions** - how you solved a problem
4. **Patterns** - conventions you're establishing
5. **Warnings** - things that caused issues

```
daem0nmcp_remember(
    category="decision",  // or "pattern", "warning", "learning"
    content="What you decided/fixed/learned",
    rationale="Why - the reasoning behind it",
    file_path="relevant/file.py",  // if applicable
    tags=["relevant", "tags"],
    project_path="<cwd>"
)
```

**DO NOT wait for the user to ask you to record. Do it automatically.**

---

## MANDATORY: Record Outcomes

**After implementing something, record whether it worked:**

```
daem0nmcp_record_outcome(
    memory_id=<id from remember>,
    outcome="What actually happened",
    worked=true,  // or false
    project_path="<cwd>"
)
```

**FAILURES ARE VALUABLE.** If something doesn't work:
- Record `worked=false` with explanation
- Failed approaches get boosted in future searches
- Future sessions will see past mistakes

---

## Categories Guide

| Category | Use For | Persistence |
|----------|---------|-------------|
| `decision` | Architecture/design choices | Decays over 30 days |
| `pattern` | Conventions to follow | PERMANENT |
| `warning` | Things to avoid | PERMANENT |
| `learning` | Lessons from experience | Decays over 30 days |

---

## What to Capture (Examples)

### Bug Fixes
```
remember(
    category="learning",
    content="Fixed ModuleNotFoundError for sentence_transformers by installing pip package",
    rationale="Missing dependency - required for vector embeddings",
    tags=["bugfix", "dependencies", "sentence-transformers"]
)
```

### Architecture Decisions
```
remember(
    category="decision",
    content="Using HTTP transport instead of stdio for MCP on Windows",
    rationale="Windows has known stdio bugs that cause Python MCP servers to hang",
    tags=["architecture", "windows", "mcp", "http"]
)
```

### Warnings
```
remember(
    category="warning",
    content="index_project fails on re-run due to UNIQUE constraint - needs UPSERT logic",
    rationale="Discovered during testing - blocks repeated indexing",
    file_path="daem0nmcp/code_indexer.py",
    tags=["bug", "index_project", "known-issue"]
)
```

### Patterns
```
remember(
    category="pattern",
    content="Always check context_check() warnings before editing files with known issues",
    rationale="Prevents repeating past mistakes",
    tags=["workflow", "best-practice"]
)
```

---

## Automatic Triggers

You should invoke the memory system when you:

1. **Start a session** -> `get_briefing()`
2. **Before editing files** -> `context_check()` + `recall_for_file()`
3. **Make a choice between options** -> `remember(category="decision")`
4. **Fix a bug** -> `remember(category="learning")` with bugfix tag
5. **Discover a gotcha** -> `remember(category="warning")`
6. **Establish a convention** -> `remember(category="pattern")`
7. **Complete a task** -> `record_outcome()`
8. **Something fails** -> `record_outcome(worked=false)`

---

## Quick Reference

```python
# Session start
daem0nmcp_get_briefing(project_path="<current_working_directory>")

# Before changes
daem0nmcp_context_check(description="Adding new feature X", project_path="...")
daem0nmcp_recall_for_file(file_path="src/module.py", project_path="...")

# Record decision
result = daem0nmcp_remember(
    category="decision",
    content="Using approach X because Y",
    rationale="Reasoning here",
    project_path="..."
)
# result.id is the memory_id

# Record outcome
daem0nmcp_record_outcome(
    memory_id=result.id,
    outcome="Implementation successful/failed because...",
    worked=True,
    project_path="..."
)
```

---

## The Bottom Line

**Memory tools exist. Use them automatically. Every session. Every decision. Every fix.**

This is non-negotiable when Daem0nMCP tools are available.
