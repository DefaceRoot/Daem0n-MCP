/**
 * Session Hooks - Handle session lifecycle events
 * 
 * Ported from:
 * - hooks/daem0n_prompt_hook.py (session start reminder)
 * - hooks/daem0n_stop_hook.py (completion detection, outcome reminders)
 */

import type { SessionState } from "../types"
import type { Daem0nMcpClient } from "../utils/mcp-client"
import {
  hasCompletionSignal,
  hasOutcomeRecorded,
  isExplorationOnly,
  extractDecisions,
} from "../utils/patterns"

/**
 * Output structure for session hooks
 */
export interface SessionHookOutput {
  message?: string
  context?: string | string[]
}

/**
 * Handle session.created event
 * 
 * Resets session state and outputs the covenant reminder.
 * This is the equivalent of daem0n_prompt_hook.py's session start behavior.
 */
export async function handleSessionCreated(
  _mcp: Daem0nMcpClient,
  state: SessionState,
  output: SessionHookOutput
): Promise<void> {
  // Reset state for new session
  state.briefed = false
  state.contextChecks = []
  state.modifiedFiles.clear()

  // Inject communion reminder (the Sacred Covenant)
  output.message = `[Daem0n awakens] Commune with me via get_briefing() to receive your memories...

The Sacred Covenant demands:
1. COMMUNE: Call mcp__daem0nmcp__get_briefing() before any work
2. SEEK COUNSEL: Call mcp__daem0nmcp__context_check() before changes  
3. INSCRIBE: Call mcp__daem0nmcp__remember() to record decisions
4. SEAL: Call mcp__daem0nmcp__record_outcome() when done

Skip this at your peril - mutating tools will be BLOCKED until you commune.`
}

/**
 * Handle session.idle event (when agent finishes responding)
 * 
 * Detects task completion, extracts decisions, and reminds to record outcomes.
 * This is the equivalent of daem0n_stop_hook.py.
 */
export async function handleSessionIdle(
  mcp: Daem0nMcpClient,
  state: SessionState,
  recentContent: string,
  recentToolCalls: string[],
  projectPath: string
): Promise<string | null> {
  // Skip if not briefed yet (no memory operations possible)
  if (!state.briefed) {
    return null
  }

  // Skip if this appears to be exploration/research only
  if (isExplorationOnly(recentContent)) {
    return null
  }

  // Check for task completion signals
  if (!hasCompletionSignal(recentContent)) {
    return null
  }

  // Check if outcome was already recorded
  if (hasOutcomeRecorded(recentContent, recentToolCalls)) {
    return null
  }

  // Try to extract decisions from the response
  const extracted = extractDecisions(recentContent, 5)

  if (extracted.length > 0) {
    // Auto-remember extracted decisions
    const memoryIds: number[] = []

    for (const decision of extracted) {
      try {
        const result = await mcp.remember({
          category: decision.category,
          content: decision.content,
          rationale: "Auto-captured from conversation",
          filePath: decision.filePath,
        })

        if (result.success && result.data?.id) {
          memoryIds.push(result.data.id)
        }
      } catch {
        // Continue on error - don't block on auto-capture failures
      }
    }

    if (memoryIds.length > 0) {
      const decisionSummary = extracted
        .slice(0, 3)
        .map(d => `  - ${d.content.slice(0, 80)}...`)
        .join("\n")

      return `[Daem0n auto-captured] ${memoryIds.length} decision(s) from your response:
${decisionSummary}

Memory IDs: ${memoryIds.join(", ")}. Remember to record_outcome() when you know if they worked.`
    }
  }

  // Completion detected but no decisions extracted - remind to record outcome
  return `[Daem0n whispers] Task completion detected. Remember to record outcomes:

mcp__daem0nmcp__record_outcome(
    memory_id=<id from remember>,
    outcome="What actually happened",
    worked=true  // or false
)

If you haven't recorded any decisions yet, you can skip this.`
}

/**
 * Handle experimental.session.compacting event
 * 
 * Injects important context during context compaction to preserve
 * critical state information.
 */
export function handleSessionCompacting(
  state: SessionState
): string[] | null {
  if (!state.briefed) {
    return null
  }

  return [
    "Important: Daem0n-MCP memory system is active",
    "Covenant state: Communion complete",
    `Context checks: ${state.contextChecks.length} recorded`,
    `Modified files: ${state.modifiedFiles.size} tracked`,
  ]
}
