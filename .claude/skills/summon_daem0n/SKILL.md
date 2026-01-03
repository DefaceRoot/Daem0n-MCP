---
name: summon-daem0n
description: Guide for initializing and consolidating Daem0n-MCP across project structures
---

# Summoning the Daem0n

This skill guides Claude through setting up Daem0n-MCP for various project structures.

## Single Repo Setup

For a single repository:

```bash
# Daem0n auto-initializes on first get_briefing()
# Just ensure you're in the project root
```

## Multi-Repo Setup (Client/Server Split)

When you have related repos that should share context:

### Option A: Consolidated Parent (Recommended)

Best when repos are siblings under a common parent:

```
/repos/
├── backend/
└── client/
```

**Steps:**

1. **Navigate to parent directory**
   ```bash
   cd /repos
   ```

2. **Initialize Daem0n in parent**
   ```
   Call get_briefing(project_path="/repos")
   ```

3. **If child repos already have .daem0nmcp data, consolidate:**
   ```
   # Link the children first
   Call link_projects(linked_path="/repos/backend", relationship="same-project")
   Call link_projects(linked_path="/repos/client", relationship="same-project")

   # Merge their databases into parent
   Call consolidate_linked_databases(archive_sources=True)
   ```

4. **Verify consolidation**
   ```
   Call get_briefing(project_path="/repos")
   # Should show combined memory count
   ```

### Option B: Linked but Separate

Best when repos need their own isolated histories but cross-awareness:

```
# In each repo, link to siblings
cd /repos/backend
Call link_projects(linked_path="/repos/client", relationship="same-project")

cd /repos/client
Call link_projects(linked_path="/repos/backend", relationship="same-project")
```

Then use `include_linked=True` on recall to span both.

## Migrating Existing Setup

If you've been launching Claude from parent directory and have a "messy" .daem0nmcp:

1. **Backup existing data**
   ```bash
   cp -r /repos/.daem0nmcp /repos/.daem0nmcp.backup
   ```

2. **Review what's there**
   ```
   Call get_briefing(project_path="/repos")
   # Check statistics and recent decisions
   ```

3. **If data is salvageable, keep it**
   - Link child repos for future cross-awareness
   - Use consolidated parent approach going forward

4. **If data is too messy, start fresh**
   ```bash
   rm -rf /repos/.daem0nmcp
   # Re-initialize with get_briefing()
   ```

## Key Commands Reference

| Command | Purpose |
|---------|---------|
| `get_briefing()` | Initialize session, creates .daem0nmcp if needed |
| `link_projects()` | Create cross-repo awareness link |
| `list_linked_projects()` | See all linked repos |
| `consolidate_linked_databases()` | Merge child DBs into parent |
| `recall(include_linked=True)` | Search across linked repos |

## Best Practices

1. **One project_path per logical project** - Even if split across repos
2. **Use parent directory for shared context** - `/repos/` not `/repos/backend/`
3. **Link before consolidating** - Links define what to merge
4. **Archive, don't delete** - `archive_sources=True` preserves originals
5. **Verify after consolidation** - Check memory counts match expectations
