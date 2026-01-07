/** Server connectivity status */
export type ServerStatus = "unknown" | "online" | "offline"

/** Goal profile for relevance-gated memory retrieval (Phase 3) */
export interface GoalProfile {
  /** Keywords extracted from root user prompt */
  keywords: Set<string>
  /** Detected domains (auth, db, api, test, config) */
  domains: Set<string>
  /** Combined focus areas for memory retrieval */
  focusAreas: string[]
}

/** Briefing digest structure (Phase 2) */
export interface BriefingDigest {
  /** Active warnings (max 3) */
  warnings: string[]
  /** Failed approaches (max 3) */
  failedApproaches: string[]
  /** Recent decisions (max 3) */
  recentDecisions: string[]
  /** Timestamp when briefing was retrieved */
  retrievedAt: Date
  /** Pre-formatted digest string for injection */
  formatted: string
}

/** Pre-edit injection debounce state (Phase 5) */
export interface PreEditDebounceState {
  /** Last injection time per file path */
  lastInjection: Map<string, Date>
  /** Last memory hashes per file to detect if new memories exist */
  lastMemoryHashes: Map<string, string>
}

export interface SessionState {
  /** Server connectivity status for this session */
  serverStatus: ServerStatus
  /** Whether communion (get_briefing) has been completed */
  briefed: boolean
  /** Timestamp when briefing was completed (Phase 2) */
  briefedAt?: Date
  /** Briefing digest for context injection (Phase 2) */
  briefingDigest?: BriefingDigest
  /** Pending memory IDs awaiting outcome recording (Phase 2) */
  pendingOutcomeIds: Set<number>
  /** Context checks (counsel) performed in this session */
  contextChecks: ContextCheck[]
  /** Files modified in this session */
  modifiedFiles: Map<string, FileModification>
  /** Whether offline message has been logged (for log-once behavior) */
  offlineLogged: boolean
  /** Root user prompt - first user message of session (Phase 3) */
  rootUserPrompt?: string
  /** Goal profile derived from root prompt (Phase 3) */
  goalProfile?: GoalProfile
  /** Timestamp of last user prompt (Phase 3) */
  lastUserPromptAt?: Date
  /** Whether briefing digest has been injected this session */
  digestInjected: boolean
  /** Deduplication set for auto-remembered content */
  dedupe: Set<string>
  /** Pre-edit injection debounce state (Phase 5) */
  preEditDebounce: PreEditDebounceState
  /** Outcome reminder shown flag (Phase 6) */
  outcomeReminderShown: boolean
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

/**
 * Mutating host tools that require covenant enforcement
 * Phase 4: These tools trigger auto-communion + auto-counsel
 */
export const MUTATING_HOST_TOOLS = new Set([
  "edit",
  "write",
  "notebook_edit",
  "bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "Bash",
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

/**
 * Phase 5: Pre-edit injection constants
 */
/** Debounce period for pre-edit injection per file (2 minutes) */
export const PRE_EDIT_DEBOUNCE_MS = 2 * 60 * 1000
/** Maximum size for pre-edit context injection (chars) */
export const PRE_EDIT_MAX_CONTEXT_SIZE = 1200
/** Maximum items per category in pre-edit injection */
export const PRE_EDIT_MAX_ITEMS = {
  failedApproaches: 3,
  warnings: 3,
  mustNot: 3,
  mustDo: 2,
  patterns: 2,
  decisions: 1,
}

/**
 * Phase 6: Auto-remember constants
 */
/** Minimum change size (chars) to trigger auto-remember */
export const AUTO_REMEMBER_MIN_CHANGE_SIZE = 100
/** Category inference patterns */
export const CATEGORY_INFERENCE_PATTERNS = {
  pattern: [
    "convention", "pattern", "always", "never", "must", "standard", 
    "approach", "style", "format", "practice",
  ],
  warning: [
    "avoid", "don't", "do not", "careful", "caution", "warning",
    "danger", "issue", "problem", "bug", "broken", "fails",
  ],
  decision: [
    "decided", "chose", "choosing", "selected", "using", "implemented",
    "architecture", "design", "approach", "solution",
  ],
}

/**
 * Phase 7: Decision extraction constants
 */
/** Maximum decisions to extract from completion text */
export const MAX_EXTRACTED_DECISIONS = 5

/**
 * Phase 8: Evidence-based outcome recording constants
 */
/** Success evidence patterns (bash output) */
export const SUCCESS_EVIDENCE_PATTERNS = [
  /exit\s+code[:\s]+0/i,
  /\b(?:all\s+)?tests?\s+pass(?:ed|ing)?\b/i,
  /\bpassed\b.*\d+\s+test/i,
  /\b\d+\s+pass(?:ed|ing)?\b/i,
  /\bbuild\s+succeed(?:ed|s)?\b/i,
  /\bsuccess(?:fully)?\b/i,
  /\bcompleted?\s+successfully\b/i,
  /\bno\s+errors?\b/i,
  /\bOK\b\s*\(\d+\s+test/i,
  /\bpytest.*\s+passed\b/i,
  /✓.*\bpass(?:ed)?\b/i,
  /PASSED/,
]
/** Failure evidence patterns (bash output) */
export const FAILURE_EVIDENCE_PATTERNS = [
  /exit\s+code[:\s]+[1-9]/i,
  /\bfail(?:ed|ure|ing)?\b/i,
  /\bFAILED\b/,
  /\berror[:\s]/i,
  /\bTraceback\b/i,
  /\bexception\b/i,
  /\bAssertionError\b/i,
  /\bTypeError\b/i,
  /\bValueError\b/i,
  /\bSyntaxError\b/i,
  /\bModuleNotFoundError\b/i,
  /\bImportError\b/i,
  /\btest.*\bfailed\b/i,
  /\d+\s+failed/i,
  /✗.*\bfail(?:ed)?\b/i,
  /FAILED/,
  /build\s+failed/i,
]
/** Minimum output length to analyze for evidence */
export const MIN_EVIDENCE_OUTPUT_LENGTH = 10
/** Maximum pending outcomes before forcing flush reminder */
export const MAX_PENDING_OUTCOMES = 10

/**
 * Phase 9: Compaction survival constants
 */
/** Maximum modified files to preserve during compaction */
export const COMPACTION_MAX_MODIFIED_FILES = 5
/** Maximum focus areas to preserve during compaction */
export const COMPACTION_MAX_FOCUS_AREAS = 3

/**
 * Phase 9: Structured compaction context for state preservation
 * 
 * This structure ensures the plugin can continue functioning correctly
 * after context window compaction by preserving critical state.
 */
export interface CompactionContext {
  /** Server connectivity status */
  serverStatus: ServerStatus
  /** Whether communion (get_briefing) was completed */
  briefed: boolean
  /** Timestamp when briefed (ISO string for serialization) */
  briefedAt?: string
  /** Number of context checks performed */
  counselCheckCount: number
  /** Most recent counsel topic */
  lastCounselTopic?: string
  /** Number of pending outcomes awaiting recording */
  pendingOutcomeCount: number
  /** Pending outcome IDs (for continuity) */
  pendingOutcomeIds: number[]
  /** Modified files in this session (max 5) */
  modifiedFiles: string[]
  /** Goal profile summary for relevance routing */
  goalSummary?: {
    domains: string[]
    focusAreas: string[]
  }
  /** Whether digest was already injected */
  digestInjected: boolean
  /** Whether outcome reminder was already shown */
  outcomeReminderShown: boolean
}
