/**
 * Post-Edit Hook - Auto-remember significant changes
 * 
 * Ported from: hooks/daem0n_post_edit_hook.py
 * 
 * Phase 6: Full auto-remember implementation with:
 * - Significance detection (patterns + file type + change size)
 * - Category inference from content (decision/pattern/warning)
 * - Automatic memory creation (no "suggest only")
 * - Deduplication via content hashing
 * - Track memory IDs in pendingOutcomeIds
 */

import type { SessionState, FileModification, GoalProfile, MemoryCategory } from "../types"
import { 
  SIGNIFICANT_PATTERNS, 
  SIGNIFICANT_EXTENSIONS, 
  CATEGORY_INFERENCE_PATTERNS,
  AUTO_REMEMBER_MIN_CHANGE_SIZE,
} from "../types"
import type { Daem0nMcpClient } from "../utils/mcp-client"

/**
 * Result from auto-remember operation
 */
export interface AutoRememberResult {
  /** Whether memory was created */
  created: boolean
  /** Memory ID if created */
  memoryId?: number
  /** Category that was used */
  category?: MemoryCategory
  /** Whether it was deduplicated (skipped) */
  deduplicated: boolean
  /** Error message if failed */
  error?: string
}

/**
 * Create a hash for deduplication
 * Hash is based on: filePath + category + normalized content
 */
export function createDedupeHash(filePath: string, category: string, content: string): string {
  // Normalize content: lowercase, remove extra whitespace
  const normalizedContent = content.toLowerCase().replace(/\s+/g, " ").trim()
  const hashInput = `${filePath}|${category}|${normalizedContent}`
  
  // Simple hash function
  let hash = 0
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

/**
 * Infer category from content and change context
 * 
 * Priority:
 * 1. Warning patterns (avoid, don't, careful, etc.)
 * 2. Pattern patterns (convention, always, never, etc.)
 * 3. Decision (default)
 */
export function inferCategory(
  content: string,
  filePath: string
): MemoryCategory {
  const contentLower = content.toLowerCase()
  
  // Check for warning patterns first (highest priority)
  for (const pattern of CATEGORY_INFERENCE_PATTERNS.warning) {
    if (contentLower.includes(pattern)) {
      return "warning"
    }
  }
  
  // Check for pattern patterns
  for (const pattern of CATEGORY_INFERENCE_PATTERNS.pattern) {
    if (contentLower.includes(pattern)) {
      return "pattern"
    }
  }
  
  // Default to decision
  return "decision"
}

/**
 * Get detected domains from file path and content
 */
function detectDomains(filePath: string, changeContent: string): string[] {
  const domains: string[] = []
  const combined = `${filePath} ${changeContent}`.toLowerCase()
  
  const domainPatterns: Record<string, string[]> = {
    auth: ["auth", "login", "password", "token", "jwt", "oauth", "credential"],
    db: ["database", "sql", "model", "schema", "migration", "table", "query"],
    api: ["endpoint", "route", "api", "request", "response", "http", "rest"],
    config: ["config", "settings", "env", "environment", "dotenv"],
    test: ["test", "spec", "mock", "fixture", "pytest", "jest"],
    frontend: ["component", "react", "vue", "ui", "css", "style", "html"],
    backend: ["server", "service", "handler", "controller", "middleware"],
  }
  
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    for (const pattern of patterns) {
      if (combined.includes(pattern)) {
        domains.push(domain)
        break
      }
    }
  }
  
  return domains
}

/**
 * Generate tags from file path, change content, and goal profile
 */
function generateTags(
  filePath: string,
  changeContent: string,
  goalProfile?: GoalProfile
): string[] {
  const tags: Set<string> = new Set()
  
  // Add file extension as tag
  const extMatch = filePath.match(/\.([^.]+)$/)
  if (extMatch) {
    tags.add(extMatch[1])
  }
  
  // Add detected domains
  const domains = detectDomains(filePath, changeContent)
  domains.forEach(d => tags.add(d))
  
  // Add goal profile focus areas (up to 3)
  if (goalProfile?.focusAreas) {
    goalProfile.focusAreas.slice(0, 3).forEach(f => tags.add(f))
  }
  
  // Add "auto-captured" tag to identify auto-remembered entries
  tags.add("auto-captured")
  
  return Array.from(tags)
}

/**
 * Create a structured content string for the memory
 */
function createMemoryContent(
  filePath: string,
  domains: string[]
): string {
  const fileName = filePath.split(/[/\\]/).pop() || filePath
  const domainStr = domains.length > 0 ? ` (${domains.join(", ")})` : ""
  return `Significant edit: ${fileName}${domainStr}`
}

/**
 * Determine if a file change is significant enough to auto-remember
 * 
 * Checks:
 * 1. File extension (is it a significant file type?)
 * 2. Pattern matching (does the change contain significant patterns?)
 * 3. Change size (large changes are usually significant)
 */
export function isSignificantChange(filePath: string, changeContent: string): boolean {
  if (!filePath) {
    return false
  }

  // Check file extension
  const lastDot = filePath.lastIndexOf(".")
  if (lastDot === -1) {
    return false
  }
  
  const ext = filePath.slice(lastDot).toLowerCase()
  if (!SIGNIFICANT_EXTENSIONS.has(ext)) {
    return false
  }

  // Check for significant patterns in the change
  const changeLower = changeContent.toLowerCase()
  for (const pattern of SIGNIFICANT_PATTERNS) {
    if (changeLower.includes(pattern.toLowerCase())) {
      return true
    }
  }

  // Large changes are usually significant
  if (changeContent.length > AUTO_REMEMBER_MIN_CHANGE_SIZE) {
    return true
  }

  return false
}

/**
 * Create a file modification record
 */
export function createFileModification(
  filePath: string,
  oldContent: string,
  newContent: string
): FileModification {
  return {
    path: filePath,
    lastModified: new Date(),
    changeSize: Math.abs(newContent.length - oldContent.length),
  }
}

/**
 * Handle post-edit: Auto-remember significant changes
 * 
 * Phase 6: Full auto-remember implementation
 * - Determines significance
 * - Infers category from content
 * - Calls remember() automatically
 * - Handles deduplication
 * - Tracks memory ID in pendingOutcomeIds
 * 
 * @param mcp - MCP client instance
 * @param filePath - Path to the file that was edited
 * @param oldString - Original content (before edit)
 * @param newString - New content (after edit)
 * @param state - Current session state
 * @param goalProfile - Optional goal profile for tag generation
 * @returns AutoRememberResult with creation status and memory ID
 */
export async function handlePostEdit(
  mcp: Daem0nMcpClient,
  filePath: string,
  oldString: string,
  newString: string,
  state: SessionState,
  goalProfile?: GoalProfile
): Promise<AutoRememberResult> {
  if (!filePath) {
    return { created: false, deduplicated: false, error: "No file path" }
  }

  // Combine old and new for pattern matching
  const changeContent = `${oldString} -> ${newString}`

  // Check if this is a significant change
  if (!isSignificantChange(filePath, changeContent)) {
    return { created: false, deduplicated: false }
  }

  // Track the modification in session state
  const modification = createFileModification(filePath, oldString, newString)
  state.modifiedFiles.set(filePath, modification)

  // Infer category from content
  const category = inferCategory(changeContent, filePath)
  
  // Generate content and tags
  const domains = detectDomains(filePath, changeContent)
  const content = createMemoryContent(filePath, domains)
  const tags = generateTags(filePath, changeContent, goalProfile)

  // Create dedupe hash
  const dedupeHash = createDedupeHash(filePath, category, content)
  
  // Check for deduplication
  if (state.dedupe.has(dedupeHash)) {
    console.log(`[Daem0nMCP] Post-edit deduplicated: ${filePath}`)
    return { created: false, deduplicated: true }
  }

  // Auto-remember via MCP
  try {
    const result = await mcp.rememberWithTimeout({
      category,
      content,
      rationale: "Auto-captured from significant edit",
      tags,
      filePath,
    }, 5000)

    if (result.success && result.data) {
      // Mark as deduplicated to prevent re-recording
      state.dedupe.add(dedupeHash)
      
      // Track memory ID for outcome recording
      const memoryId = result.data.id
      state.pendingOutcomeIds.add(memoryId)
      
      console.log(`[Daem0nMCP] Auto-remembered: ${content} (id: ${memoryId}, category: ${category})`)
      
      return {
        created: true,
        memoryId,
        category,
        deduplicated: false,
      }
    } else {
      console.warn(`[Daem0nMCP] Auto-remember failed:`, result.error)
      return {
        created: false,
        deduplicated: false,
        error: result.error || "Unknown error",
      }
    }
  } catch (err) {
    console.error("[Daem0nMCP] Auto-remember error:", err)
    return {
      created: false,
      deduplicated: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Get statistics about modified files in the current session
 */
export function getModifiedFilesStats(state: SessionState): {
  count: number
  totalChangeSize: number
  files: string[]
} {
  let totalChangeSize = 0
  const files: string[] = []

  for (const [path, mod] of state.modifiedFiles) {
    totalChangeSize += mod.changeSize
    files.push(path)
  }

  return {
    count: state.modifiedFiles.size,
    totalChangeSize,
    files,
  }
}

/**
 * Legacy function for backwards compatibility
 * Returns suggestion message instead of auto-remembering
 */
export function suggestRemember(
  filePath: string,
  changeContent: string
): string | null {
  if (!isSignificantChange(filePath, changeContent)) {
    return null
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath
  return `[Daem0n suggests] Significant change to ${fileName}. Consider:
mcp__daem0nmcp__remember(category='decision', content='...', file_path='${filePath}')`
}
