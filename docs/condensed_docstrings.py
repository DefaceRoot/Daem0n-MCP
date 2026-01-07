"""
Condensed Tool Docstrings for Daem0nMCP
========================================

This file contains token-optimized docstrings for all MCP tools.
Estimated savings: ~4,000-6,000 tokens from the initial context load.

Original: ~38 lines avg per tool docstring
Condensed: ~8 lines avg per tool docstring

USAGE: Replace the docstrings in server.py with these condensed versions.
All functionality and parameter documentation is preserved.
"""


# =============================================================================
# CORE MEMORY TOOLS
# =============================================================================

def remember():
    """
    Store a memory (decision/pattern/warning/learning).
    Auto-detects conflicts with past failures. Patterns and warnings are permanent.

    Args:
        category: One of 'decision', 'pattern', 'warning', 'learning'
        content: What to remember
        rationale: Why this matters
        context: Structured context dict
        tags: List of tags for retrieval
        file_path: Associate with a file
        project_path: Project root
    """


def remember_batch():
    """
    Store multiple memories atomically. Efficient for bulk imports.

    Args:
        memories: List of dicts with category, content, rationale (opt), tags (opt), file_path (opt)
        project_path: Project root
    """


def recall():
    """
    Semantic search for memories using TF-IDF. Results weighted by relevance, recency, importance.

    Args:
        topic: What to search for
        categories: Filter by category
        tags: Filter by tags
        file_path: Filter by file
        offset/limit: Pagination
        since/until: Date range (ISO format)
        project_path: Project root
        include_linked: Search linked projects
        condensed: Compress output (~75% token reduction)
    """


def add_rule():
    """
    Add a decision tree rule. Rules are matched semantically.

    Args:
        trigger: What activates this rule (natural language)
        must_do: Required actions
        must_not: Forbidden actions
        ask_first: Questions to consider
        warnings: Past experience warnings
        priority: Higher = shown first
        project_path: Project root
    """


def check_rules():
    """
    Check if an action matches any rules. Call before significant changes.

    Args:
        action: What you're about to do
        context: Optional context dict
        project_path: Project root
    """


def record_outcome():
    """
    Record whether a decision worked. Failed outcomes get boosted in future searches.

    Args:
        memory_id: ID from remember()
        outcome: What happened
        worked: True/False
        project_path: Project root
    """


def get_briefing():
    """
    Session start - call FIRST. Returns stats, recent decisions, warnings, failed approaches, git changes.

    Args:
        project_path: Project root (REQUIRED)
        focus_areas: Topics to pre-fetch
    """


def search_memories():
    """
    Full-text search across all memories with TF-IDF ranking.

    Args:
        query: Search text
        limit/offset: Pagination
        include_meta: Return pagination metadata
        highlight: Include matched term excerpts
        highlight_start/end: Tags for highlighting
        project_path: Project root
    """


def list_rules():
    """
    List all configured rules.

    Args:
        enabled_only: Only show enabled rules
        limit: Max results
        project_path: Project root
    """


def update_rule():
    """
    Update an existing rule.

    Args:
        rule_id: ID of rule to update
        must_do/must_not/ask_first/warnings: New lists (replace existing)
        priority: New priority
        enabled: Enable/disable
        project_path: Project root
    """


def find_related():
    """
    Find memories semantically related to a specific memory.

    Args:
        memory_id: Memory to find relations for
        limit: Max results
        project_path: Project root
    """


def context_check():
    """
    Pre-flight check combining recall + check_rules. Issues preflight token valid for 5 min.

    Args:
        description: What you're about to do
        project_path: Project root
    """


def recall_for_file():
    """
    Get all memories associated with a specific file.

    Args:
        file_path: File to look up
        limit: Max results
        project_path: Project root
    """


# =============================================================================
# MAINTENANCE TOOLS
# =============================================================================

def scan_todos():
    """
    Scan codebase for TODO/FIXME/HACK/XXX/BUG comments.

    Args:
        path: Directory to scan
        auto_remember: Save as warning memories
        types: Filter to specific types
        project_path: Project root
    """


def ingest_doc():
    """
    Fetch external docs from URL and store as learnings. Content is chunked.

    Args:
        url: URL to fetch
        topic: Tag for organizing
        chunk_size: Max chars per chunk
        project_path: Project root
    """


def propose_refactor():
    """
    Generate refactor suggestions combining file memories, causal history, TODOs, and rules.

    Args:
        file_path: File to analyze
        project_path: Project root
    """


def rebuild_index():
    """
    Force rebuild of TF-IDF/vector indexes. Use if search seems stale.

    Args:
        project_path: Project root
    """


def export_data():
    """
    Export all memories and rules as JSON for backup/migration.

    Args:
        project_path: Project root
        include_vectors: Include embeddings (large)
    """


def import_data():
    """
    Import memories/rules from exported JSON.

    Args:
        data: Exported data structure
        merge: Add to existing (True) or replace all (False)
        project_path: Project root
    """


def pin_memory():
    """
    Pin/unpin a memory. Pinned memories: never pruned, boosted in recall, permanent.

    Args:
        memory_id: Memory to pin
        pinned: True to pin, False to unpin
        project_path: Project root
    """


def archive_memory():
    """
    Archive/unarchive a memory. Archived = hidden from recall but preserved.

    Args:
        memory_id: Memory to archive
        archived: True to archive, False to restore
        project_path: Project root
    """


def prune_memories():
    """
    Prune old low-value memories. Protected: permanent, pinned, with outcomes, frequently accessed.

    Args:
        older_than_days: Age threshold
        categories: Limit to these categories
        min_recall_count: Protect if accessed >= N times
        protect_successful: Protect worked=True
        dry_run: Preview only
        project_path: Project root
    """


def cleanup_memories():
    """
    Merge duplicate memories (same category + content + file_path). Keeps newest.

    Args:
        dry_run: Preview only
        merge_duplicates: Actually merge
        project_path: Project root
    """


def compact_memories():
    """
    Consolidate recent episodic memories into a summary. Originals archived with graph links.

    Args:
        summary: Summary text (min 50 chars)
        limit: Max memories to compact
        topic: Filter by topic
        dry_run: Preview only
        project_path: Project root
    """


def health():
    """
    Get server health, version, and statistics.

    Args:
        project_path: Project root
    """


# =============================================================================
# GRAPH MEMORY TOOLS
# =============================================================================

def link_memories():
    """
    Create relationship between memories. Types: led_to, supersedes, depends_on, conflicts_with, related_to.

    Args:
        source_id: From memory ID
        target_id: To memory ID
        relationship: Relationship type
        description: Optional context
        project_path: Project root
    """


def unlink_memories():
    """
    Remove relationship between memories.

    Args:
        source_id: From memory ID
        target_id: To memory ID
        relationship: Specific type to remove (None = all)
        project_path: Project root
    """


def trace_chain():
    """
    Traverse memory graph to understand causal chains and dependencies.

    Args:
        memory_id: Starting point
        direction: forward/backward/both
        relationship_types: Filter by type
        max_depth: How far to traverse
        project_path: Project root
    """


def get_graph():
    """
    Get subgraph of memories and relationships as JSON or Mermaid diagram.

    Args:
        memory_ids: Specific IDs to include
        topic: Alternative to memory_ids
        format: json or mermaid
        project_path: Project root
    """


# =============================================================================
# CODE UNDERSTANDING TOOLS
# =============================================================================

def index_project():
    """
    Index code structure using tree-sitter. Extracts classes, functions, methods with signatures.

    Args:
        path: Path to index
        patterns: Glob patterns for files
        project_path: Project root
    """


def find_code():
    """
    Semantic search across indexed code entities using vector similarity.

    Args:
        query: Natural language query
        limit: Max results
        project_path: Project root
    """


def analyze_impact():
    """
    Analyze blast radius of changing a code entity. Finds affected files and dependents.

    Args:
        entity_name: Function/class/method name
        project_path: Project root
    """


# =============================================================================
# LINKED PROJECTS TOOLS
# =============================================================================

def link_projects():
    """
    Link to another project for cross-project memory reading (write isolation preserved).

    Args:
        linked_path: Path to link
        relationship: same-project/upstream/downstream/related
        label: Optional human-readable label
        project_path: Project root
    """


def unlink_projects():
    """
    Remove project link.

    Args:
        linked_path: Path to unlink
        project_path: Project root
    """


def list_linked_projects():
    """
    List all linked projects.

    Args:
        project_path: Project root
    """


def consolidate_linked_databases():
    """
    Merge memories from all linked projects into this one. For monorepo transitions.

    Args:
        archive_sources: Rename source .daem0nmcp to .daem0nmcp.archived
        project_path: Project root
    """


# =============================================================================
# ACTIVE CONTEXT TOOLS (MemGPT-style)
# =============================================================================

def set_active_context():
    """
    Add memory to always-hot working context. Auto-included in briefings.

    Args:
        memory_id: Memory to add
        reason: Why it should stay hot
        priority: Higher = shown first
        expires_in_hours: Auto-remove after N hours
        project_path: Project root
    """


def get_active_context():
    """
    Get all always-hot memories ordered by priority.

    Args:
        project_path: Project root
    """


def remove_from_active_context():
    """
    Remove memory from active context.

    Args:
        memory_id: Memory to remove
        project_path: Project root
    """


def clear_active_context():
    """
    Clear all active context memories. Use when switching focus.

    Args:
        project_path: Project root
    """


# =============================================================================
# TEMPORAL VERSIONING TOOLS
# =============================================================================

def get_memory_versions():
    """
    Get version history showing how a memory evolved over time.

    Args:
        memory_id: Memory to query
        limit: Max versions
        project_path: Project root
    """


def get_memory_at_time():
    """
    Get memory state at a specific point in time.

    Args:
        memory_id: Memory to query
        timestamp: ISO format timestamp
        project_path: Project root
    """


# =============================================================================
# COMMUNITY TOOLS (GraphRAG-style)
# =============================================================================

def rebuild_communities():
    """
    Detect memory communities based on tag co-occurrence. Auto-generates summaries.

    Args:
        min_community_size: Min members per community
        project_path: Project root
    """


def list_communities():
    """
    List all memory communities with summaries.

    Args:
        level: Filter by hierarchy level
        project_path: Project root
    """


def get_community_details():
    """
    Get full community details including all member memories.

    Args:
        community_id: Community to expand
        project_path: Project root
    """


def recall_hierarchical():
    """
    GraphRAG-style layered recall: community summaries first, then individual memories.

    Args:
        topic: What to search for
        include_members: Include full member content
        limit: Max results per layer
        project_path: Project root
    """


# =============================================================================
# ENTITY TOOLS
# =============================================================================

def recall_by_entity():
    """
    Get all memories mentioning a specific entity (class/function/file).

    Args:
        entity_name: Entity to search for
        entity_type: Optional type filter
        project_path: Project root
    """


def list_entities():
    """
    List most frequently mentioned entities.

    Args:
        entity_type: Optional type filter
        limit: Max results
        project_path: Project root
    """


def backfill_entities():
    """
    Extract entities from all existing memories. Safe to run multiple times.

    Args:
        project_path: Project root
    """


# =============================================================================
# CONTEXT TRIGGER TOOLS
# =============================================================================

def add_context_trigger():
    """
    Create auto-recall trigger. Types: file_pattern (glob), tag_match (regex), entity_match (regex).

    Args:
        trigger_type: file_pattern/tag_match/entity_match
        pattern: Glob or regex pattern
        recall_topic: Topic to recall when triggered
        recall_categories: Optional category filter
        priority: Higher = evaluated first
        project_path: Project root
    """


def list_context_triggers():
    """
    List all configured context triggers.

    Args:
        active_only: Only return active triggers
        project_path: Project root
    """


def remove_context_trigger():
    """
    Remove a context trigger.

    Args:
        trigger_id: ID of trigger to remove
        project_path: Project root
    """


def check_context_triggers():
    """
    Check which triggers match context and get auto-recalled memories.

    Args:
        file_path: Match against file_pattern triggers
        tags: Match against tag_match triggers
        entities: Match against entity_match triggers
        limit: Max memories per trigger
        project_path: Project root
    """
