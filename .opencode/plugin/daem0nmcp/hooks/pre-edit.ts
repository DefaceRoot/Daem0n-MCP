/**
 * Pre-Edit Hook - Memory injection before file modifications
 * 
 * Ported from: hooks/daem0n_pre_edit_hook.py
 * 
 * Features:
 * - Recalls memories linked to the file being modified
 * - Checks context triggers for pattern-based auto-recall
 * - Injects warnings, failed approaches, must_do/must_not into context
 */

import type { Memory, RecallResult } from "../types"
import type { Daem0nMcpClient } from "../utils/mcp-client"

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
 * Format recall_for_file result as human-readable context
 */
export function formatMemoryContext(result: RecallForFileResult): string {
  const parts: string[] = []
  const fileName = result.file.split(/[/\\]/).pop() || result.file

  // Warnings are most important
  const warnings = result.warnings || []
  const failedApproaches = warnings.filter(w => w.type === "FAILED_APPROACH")
  const generalWarnings = warnings.filter(w => w.type === "WARNING")
  const ruleWarnings = warnings.filter(w => w.type === "RULE_WARNING")

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

  if (ruleWarnings.length > 0) {
    parts.push("**Rule warnings:**")
    for (const w of ruleWarnings.slice(0, 2)) {
      parts.push(`  - ${w.content.slice(0, 150)}`)
    }
  }

  // Must do / Must not from rules
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
 * Format context trigger results as human-readable context
 */
export function formatTriggerContext(result: ContextTriggerResult): string {
  const parts: string[] = []
  const triggers = result.triggers || []
  const memories = result.memories || {}

  if (triggers.length === 0) {
    return ""
  }

  parts.push("**Auto-recalled from context triggers:**")

  // Show which triggers matched
  for (const trigger of triggers.slice(0, 3)) {
    parts.push(`  Trigger: ${trigger.pattern} -> recall '${trigger.recall_topic}'`)
  }

  // Show recalled memories by topic
  for (const [_topic, recalled] of Object.entries(memories)) {
    // Warnings first (most important)
    for (const mem of (recalled.warnings || []).slice(0, 2)) {
      parts.push(`    [warning] ${mem.content.slice(0, 120)}`)
    }

    // Then patterns
    for (const mem of (recalled.patterns || []).slice(0, 2)) {
      parts.push(`    [pattern] ${mem.content.slice(0, 120)}`)
    }

    // Then decisions
    for (const mem of (recalled.decisions || []).slice(0, 1)) {
      parts.push(`    [decision] ${mem.content.slice(0, 120)}`)
    }
  }

  return parts.join("\n")
}

/**
 * Handle pre-edit memory injection
 * 
 * Called before file edit/write tools to inject relevant memories.
 * 
 * @param mcp - MCP client instance
 * @param filePath - Path to the file being edited
 * @returns Context string to inject, or null if nothing to inject
 */
export async function handlePreEdit(
  mcp: Daem0nMcpClient,
  filePath: string
): Promise<string | null> {
  if (!filePath) {
    return null
  }

  const contextParts: string[] = []

  // 1. Recall memories directly associated with this file
  try {
    const recallResult = await mcp.recallForFile(filePath)
    
    if (recallResult.success && recallResult.data) {
      const data = recallResult.data as unknown as RecallForFileResult
      const hasContent = (
        data.warnings?.length > 0 ||
        data.must_do?.length > 0 ||
        data.must_not?.length > 0 ||
        data.blockers?.length > 0
      )

      if (hasContent) {
        const context = formatMemoryContext(data)
        if (context) {
          contextParts.push(context)
        }
      }
    }
  } catch (error) {
    console.error("[Daem0nMCP] Error in pre-edit recall:", error)
  }

  // 2. Check context triggers for pattern-based auto-recall
  try {
    const triggerResult = await mcp.checkContextTriggers(filePath)
    
    if (triggerResult.success && triggerResult.data) {
      if (triggerResult.data.total_triggers > 0) {
        const triggerContext = formatTriggerContext(triggerResult.data as unknown as ContextTriggerResult)
        if (triggerContext) {
          contextParts.push(triggerContext)
        }
      }
    }
  } catch (error) {
    console.error("[Daem0nMCP] Error checking context triggers:", error)
  }

  return contextParts.length > 0 ? contextParts.join("\n\n") : null
}
