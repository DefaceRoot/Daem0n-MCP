/**
 * Pre-Edit Hook - Memory injection before file modifications
 * 
 * Ported from: hooks/daem0n_pre_edit_hook.py
 * 
 * Phase 5: Full pre-edit memory injection with:
 * - Bounded retrieval (recall_for_file with limit)
 * - Context triggers (pattern-based auto-recall)
 * - Priority-ordered filtering (failed > warnings > must_not > must_do > patterns > decisions)
 * - Size-capped output (~1200 chars)
 * - Goal profile relevance gating
 * - Debounce support (2 min per file, checked in index.ts)
 */

import type { Memory, RecallResult, GoalProfile, SessionState } from "../types"
import { PRE_EDIT_MAX_CONTEXT_SIZE, PRE_EDIT_MAX_ITEMS } from "../types"
import type { Daem0nMcpClient } from "../utils/mcp-client"
import { matchesGoalProfile } from "../utils/goal-profile"

/**
 * Result from recall_for_file MCP tool
 */
export interface RecallForFileResult {
  file: string
  warnings: Array<{
    type: "FAILED_APPROACH" | "WARNING" | "RULE_WARNING"
    content: string
    outcome?: string
  }>
  must_do: string[]
  must_not: string[]
  blockers: string[]
  memories?: Memory[]
}

/**
 * Result from check_context_triggers MCP tool
 */
export interface ContextTriggerResult {
  triggers: Array<{
    pattern: string
    recall_topic: string
  }>
  memories: Record<string, RecallResult>
  total_triggers: number
}

/**
 * Pre-edit injection result
 */
export interface PreEditInjectionResult {
  /** Formatted context string for injection */
  context: string
  /** Hash of context for deduplication */
  hash: string
  /** Number of items included */
  itemCount: number
  /** Whether context was truncated to fit size limit */
  truncated: boolean
}

/**
 * Priority-ordered item for injection
 */
interface PriorityItem {
  priority: number  // Lower = higher priority
  category: string
  content: string
}

/**
 * Create a simple hash of content for deduplication
 */
export function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(16)
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + "..."
}

/**
 * Filter memories by goal profile relevance
 */
function filterByGoalProfile(
  memories: Memory[] | undefined,
  goalProfile: GoalProfile | undefined
): Memory[] {
  if (!memories || memories.length === 0) return []
  if (!goalProfile) return memories // No filtering if no goal profile

  return memories.filter(mem => 
    matchesGoalProfile(mem.tags || [], mem.content, goalProfile)
  )
}

/**
 * Build priority-ordered items from recall results
 * Priority order: failed approaches (1) > warnings (2) > must_not (3) > must_do (4) > patterns (5) > decisions (6)
 */
function buildPriorityItems(
  recallResult: RecallForFileResult | null,
  triggerMemories: Record<string, RecallResult> | null,
  goalProfile: GoalProfile | undefined
): PriorityItem[] {
  const items: PriorityItem[] = []
  
  // 1. Failed approaches from recall_for_file (highest priority)
  if (recallResult?.warnings) {
    const failed = recallResult.warnings.filter(w => w.type === "FAILED_APPROACH")
    for (const f of failed.slice(0, PRE_EDIT_MAX_ITEMS.failedApproaches)) {
      let content = truncate(f.content, 150)
      if (f.outcome) {
        content += ` [Outcome: ${truncate(f.outcome, 80)}]`
      }
      items.push({ priority: 1, category: "FAILED", content })
    }
  }

  // 2. Warnings
  if (recallResult?.warnings) {
    const generalWarnings = recallResult.warnings.filter(w => w.type === "WARNING")
    for (const w of generalWarnings.slice(0, PRE_EDIT_MAX_ITEMS.warnings)) {
      items.push({ priority: 2, category: "WARNING", content: truncate(w.content, 150) })
    }
  }

  // 3. Must NOT do
  if (recallResult?.must_not) {
    for (const item of recallResult.must_not.slice(0, PRE_EDIT_MAX_ITEMS.mustNot)) {
      items.push({ priority: 3, category: "MUST_NOT", content: truncate(item, 100) })
    }
  }

  // 4. Must do
  if (recallResult?.must_do) {
    for (const item of recallResult.must_do.slice(0, PRE_EDIT_MAX_ITEMS.mustDo)) {
      items.push({ priority: 4, category: "MUST_DO", content: truncate(item, 100) })
    }
  }

  // 5. Patterns from trigger memories (filtered by goal profile)
  if (triggerMemories) {
    for (const recalled of Object.values(triggerMemories)) {
      // Patterns from triggers
      const relevantPatterns = filterByGoalProfile(recalled.patterns, goalProfile)
      for (const p of relevantPatterns.slice(0, PRE_EDIT_MAX_ITEMS.patterns)) {
        items.push({ priority: 5, category: "PATTERN", content: truncate(p.content, 120) })
      }
      
      // Warnings from triggers (same priority as file warnings)
      const relevantWarnings = filterByGoalProfile(recalled.warnings, goalProfile)
      for (const w of relevantWarnings.slice(0, 2)) {
        items.push({ priority: 2, category: "WARNING", content: truncate(w.content, 120) })
      }
    }
  }

  // 6. Decisions (lowest priority, only if space)
  if (recallResult?.memories) {
    const decisions = recallResult.memories.filter(m => m.category === "decision")
    const relevantDecisions = filterByGoalProfile(decisions, goalProfile)
    for (const d of relevantDecisions.slice(0, PRE_EDIT_MAX_ITEMS.decisions)) {
      items.push({ priority: 6, category: "DECISION", content: truncate(d.content, 120) })
    }
  }

  // Sort by priority
  items.sort((a, b) => a.priority - b.priority)

  return items
}

/**
 * Format priority items into bounded context string
 */
function formatBoundedContext(items: PriorityItem[], filePath: string): PreEditInjectionResult {
  if (items.length === 0) {
    return { context: "", hash: "", itemCount: 0, truncated: false }
  }

  const fileName = filePath.split(/[/\\]/).pop() || filePath
  const header = `[Daem0n recalls for ${fileName}]`
  const parts: string[] = [header]
  let currentSize = header.length
  let itemCount = 0
  let truncated = false

  for (const item of items) {
    const line = `  [${item.category}] ${item.content}`
    const lineSize = line.length + 1 // +1 for newline

    if (currentSize + lineSize > PRE_EDIT_MAX_CONTEXT_SIZE) {
      truncated = true
      break
    }

    parts.push(line)
    currentSize += lineSize
    itemCount++
  }

  const context = parts.join("\n")
  const hash = hashContent(context)

  return { context, hash, itemCount, truncated }
}

/**
 * Handle pre-edit memory injection with bounded retrieval and priority ordering
 * 
 * Phase 5: Full implementation with:
 * - Bounded retrieval (recall_for_file with limit)
 * - Context triggers
 * - Priority-ordered filtering
 * - Size cap (~1200 chars)
 * - Goal profile filtering
 * 
 * @param mcp - MCP client instance
 * @param filePath - Path to the file being edited
 * @param goalProfile - Optional goal profile for relevance filtering
 * @param state - Session state (for debounce checking)
 * @returns PreEditInjectionResult with context and metadata
 */
export async function handlePreEdit(
  mcp: Daem0nMcpClient,
  filePath: string,
  goalProfile?: GoalProfile,
  state?: SessionState
): Promise<PreEditInjectionResult | null> {
  if (!filePath) {
    return null
  }

  let recallResult: RecallForFileResult | null = null
  let triggerMemories: Record<string, RecallResult> | null = null
  let hasAnyContent = false

  // 1. Recall memories directly associated with this file (bounded)
  try {
    const result = await mcp.recallForFileWithLimit(filePath, 10, 3000)
    
    if (result.success && result.data) {
      recallResult = result.data as unknown as RecallForFileResult
      hasAnyContent = (
        (recallResult.warnings?.length || 0) > 0 ||
        (recallResult.must_do?.length || 0) > 0 ||
        (recallResult.must_not?.length || 0) > 0 ||
        (recallResult.blockers?.length || 0) > 0
      )
    }
  } catch (error) {
    console.error("[Daem0nMCP] Error in pre-edit recall:", error)
  }

  // 2. Check context triggers for pattern-based auto-recall
  try {
    const triggerResult = await mcp.checkContextTriggersWithTimeout(filePath, 3000)
    
    if (triggerResult.success && triggerResult.data && triggerResult.data.total_triggers > 0) {
      triggerMemories = triggerResult.data.memories
      hasAnyContent = true
    }
  } catch (error) {
    console.error("[Daem0nMCP] Error checking context triggers:", error)
  }

  // 3. If no file-specific content and goal profile has domains, do condensed recall
  if (!hasAnyContent && goalProfile && goalProfile.focusAreas.length > 0) {
    try {
      const topDomain = goalProfile.focusAreas[0]
      const domainResult = await mcp.recallCondensedWithTimeout(topDomain, 3000)
      
      if (domainResult.success && domainResult.data) {
        const recalled = domainResult.data
        const relevantWarnings = filterByGoalProfile(recalled.warnings, goalProfile)
        const relevantPatterns = filterByGoalProfile(recalled.patterns, goalProfile)
        
        if (relevantWarnings.length > 0 || relevantPatterns.length > 0) {
          // Create synthetic trigger memories for domain-based recall
          triggerMemories = { [topDomain]: recalled }
          hasAnyContent = true
        }
      }
    } catch (error) {
      console.error("[Daem0nMCP] Error in domain recall:", error)
    }
  }

  // Build priority-ordered items
  const items = buildPriorityItems(recallResult, triggerMemories, goalProfile)
  
  if (items.length === 0) {
    return null
  }

  // Format with size cap
  const result = formatBoundedContext(items, filePath)
  
  if (result.context.length === 0) {
    return null
  }

  console.log(`[Daem0nMCP] Pre-edit context: ${result.itemCount} items, ${result.context.length} chars${result.truncated ? " (truncated)" : ""}`)

  return result
}

/**
 * Check if pre-edit injection should be debounced for this file
 * @param state Session state with debounce info
 * @param filePath Path to the file
 * @param newHash Hash of new content
 * @returns true if injection should be skipped (debounced)
 */
export function shouldDebouncePreEdit(
  state: SessionState,
  filePath: string,
  newHash: string
): boolean {
  const { preEditDebounce } = state
  
  if (!preEditDebounce) {
    return false
  }

  const lastTime = preEditDebounce.lastInjection.get(filePath)
  const lastHash = preEditDebounce.lastMemoryHashes.get(filePath)
  
  if (!lastTime) {
    return false // Never injected for this file
  }

  const now = Date.now()
  const elapsed = now - lastTime.getTime()
  const PRE_EDIT_DEBOUNCE_MS = 2 * 60 * 1000 // 2 minutes
  
  // If within debounce window AND hash hasn't changed, skip
  if (elapsed < PRE_EDIT_DEBOUNCE_MS && lastHash === newHash) {
    return true
  }

  return false
}

/**
 * Update debounce state after successful injection
 */
export function updateDebounceState(
  state: SessionState,
  filePath: string,
  hash: string
): void {
  if (!state.preEditDebounce) {
    return
  }

  state.preEditDebounce.lastInjection.set(filePath, new Date())
  state.preEditDebounce.lastMemoryHashes.set(filePath, hash)
}

/**
 * Legacy format function for backwards compatibility
 */
export function formatMemoryContext(result: RecallForFileResult): string {
  const parts: string[] = []
  const fileName = result.file.split(/[/\\]/).pop() || result.file

  const warnings = result.warnings || []
  const failedApproaches = warnings.filter(w => w.type === "FAILED_APPROACH")
  const generalWarnings = warnings.filter(w => w.type === "WARNING")

  if (failedApproaches.length > 0) {
    parts.push("**Failed approaches (avoid repeating):**")
    for (const f of failedApproaches.slice(0, 3)) {
      parts.push(`  - ${f.content.slice(0, 150)}`)
      if (f.outcome) {
        parts.push(`    Outcome: ${f.outcome.slice(0, 100)}`)
      }
    }
  }

  if (generalWarnings.length > 0) {
    parts.push("**Warnings for this file:**")
    for (const w of generalWarnings.slice(0, 3)) {
      parts.push(`  - ${w.content.slice(0, 150)}`)
    }
  }

  if (result.must_do?.length > 0) {
    parts.push("**Must do:**")
    for (const item of result.must_do.slice(0, 3)) {
      parts.push(`  - ${item.slice(0, 100)}`)
    }
  }

  if (result.must_not?.length > 0) {
    parts.push("**Must NOT do:**")
    for (const item of result.must_not.slice(0, 3)) {
      parts.push(`  - ${item.slice(0, 100)}`)
    }
  }

  return parts.length > 0 
    ? `[Daem0n recalls for ${fileName}]\n${parts.join("\n")}` 
    : ""
}

/**
 * Legacy format function for context triggers
 */
export function formatTriggerContext(result: ContextTriggerResult): string {
  const parts: string[] = []
  const triggers = result.triggers || []
  const memories = result.memories || {}

  if (triggers.length === 0) {
    return ""
  }

  parts.push("**Auto-recalled from context triggers:**")

  for (const trigger of triggers.slice(0, 3)) {
    parts.push(`  Trigger: ${trigger.pattern} -> recall '${trigger.recall_topic}'`)
  }

  for (const [_topic, recalled] of Object.entries(memories)) {
    for (const mem of (recalled.warnings || []).slice(0, 2)) {
      parts.push(`    [warning] ${mem.content.slice(0, 120)}`)
    }
    for (const mem of (recalled.patterns || []).slice(0, 2)) {
      parts.push(`    [pattern] ${mem.content.slice(0, 120)}`)
    }
    for (const mem of (recalled.decisions || []).slice(0, 1)) {
      parts.push(`    [decision] ${mem.content.slice(0, 120)}`)
    }
  }

  return parts.join("\n")
}
