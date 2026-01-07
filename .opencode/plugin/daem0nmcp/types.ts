export interface SessionState {
  briefed: boolean
  contextChecks: ContextCheck[]
  modifiedFiles: Map<string, FileModification>
}

export interface ContextCheck {
  topic: string
  timestamp: Date
  preflightToken?: string
}

export interface FileModification {
  path: string
  lastModified: Date
  changeSize: number
}

export interface CovenantViolation {
  status: "blocked"
  violation: "COMMUNION_REQUIRED" | "COUNSEL_REQUIRED" | "COUNSEL_EXPIRED"
  message: string
  projectPath: string
  toolBlocked?: string
  remedy: {
    tool: string
    args: Record<string, unknown>
    description: string
  }
}

export interface MCPToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export type MemoryCategory = "decision" | "pattern" | "warning" | "learning"

export type RelationshipType = 
  | "led_to" 
  | "supersedes" 
  | "depends_on" 
  | "conflicts_with" 
  | "related_to"

export interface BriefingResponse {
  project_path: string
  stats: {
    total_memories: number
    decisions: number
    patterns: number
    warnings: number
    learnings: number
    rules: number
  }
  recent_decisions: Memory[]
  active_warnings: Memory[]
  failed_approaches: Memory[]
  active_context: Memory[]
  git_changes?: string[]
  focus_area_context?: Record<string, RecallResult>
}

export interface Memory {
  id: number
  category: MemoryCategory
  content: string
  rationale?: string
  tags: string[]
  file_path?: string
  created_at: string
  outcome?: string
  worked?: boolean
}

export interface RecallResult {
  decisions: Memory[]
  patterns: Memory[]
  warnings: Memory[]
  learnings: Memory[]
  total: number
}

export interface ContextCheckResult {
  topic: string
  memories: RecallResult
  rules: RuleMatch[]
  preflight_token: string
}

export interface RuleMatch {
  id: number
  trigger: string
  must_do: string[]
  must_not: string[]
  ask_first: string[]
  score: number
}

export const COVENANT_EXEMPT_TOOLS = new Set([
  "get_briefing",
  "health",
  "context_check",
  "recall",
  "recall_for_file",
  "search_memories",
  "find_related",
  "check_rules",
  "list_rules",
  "find_code",
  "analyze_impact",
  "export_data",
  "scan_todos",
  "propose_refactor",
  "get_graph",
  "trace_chain",
  "get_memory_versions",
  "get_memory_at_time",
  "list_communities",
  "get_community_details",
  "recall_hierarchical",
  "recall_by_entity",
  "list_entities",
  "list_context_triggers",
  "check_context_triggers",
  "get_active_context",
  "list_linked_projects",
])

export const COMMUNION_REQUIRED_TOOLS = new Set([
  "remember",
  "remember_batch",
  "add_rule",
  "update_rule",
  "record_outcome",
  "link_memories",
  "unlink_memories",
  "pin_memory",
  "archive_memory",
  "prune_memories",
  "cleanup_memories",
  "compact_memories",
  "import_data",
  "rebuild_index",
  "index_project",
  "ingest_doc",
  "set_active_context",
  "remove_from_active_context",
  "clear_active_context",
  "add_context_trigger",
  "remove_context_trigger",
  "rebuild_communities",
  "backfill_entities",
  "link_projects",
  "unlink_projects",
  "consolidate_linked_databases",
])

export const COUNSEL_REQUIRED_TOOLS = new Set([
  "remember",
  "remember_batch",
  "add_rule",
  "update_rule",
  "prune_memories",
  "cleanup_memories",
  "compact_memories",
  "import_data",
  "ingest_doc",
])

export const COUNSEL_TTL_MS = 5 * 60 * 1000

export const FILE_EDIT_TOOLS = new Set([
  "edit",
  "write",
  "notebook_edit",
  "Edit",
  "Write",
  "NotebookEdit",
])

export const SIGNIFICANT_PATTERNS = [
  "class ", "def __init__", "async def ", "@dataclass", "@mcp.tool",
  "config", "settings", "environment", "env",
  "auth", "password", "token", "secret", "credential",
  "migration", "schema", "model", "table", "column",
  "endpoint", "route", "api", "request", "response",
]

export const SIGNIFICANT_EXTENSIONS = new Set([
  ".py", ".ts", ".js", ".go", ".rs", ".java",
  ".yaml", ".yml", ".json", ".toml",
  ".sql", ".prisma",
])
