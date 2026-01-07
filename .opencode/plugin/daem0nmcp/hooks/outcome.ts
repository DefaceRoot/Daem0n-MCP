/**
 * Outcome Recording - Evidence-based automatic outcome tracking
 * 
 * Phase 8: Fire-and-forget outcome recording when evidence exists
 * 
 * Features:
 * - Parses bash output for success/failure signals
 * - Auto-records outcomes for pending memories when evidence is strong
 * - Clears pendingOutcomeIds after recording
 * - Does not guess when evidence is inconclusive
 */

import type { SessionState } from "../types"
import type { Daem0nMcpClient } from "../utils/mcp-client"
import { detectEvidence, isTestOrBuildOutput, type EvidenceResult } from "../utils/patterns"

/**
 * Result from outcome recording
 */
export interface OutcomeRecordingResult {
  /** Whether outcomes were recorded */
  recorded: boolean
  /** Number of outcomes successfully recorded */
  successCount: number
  /** Number of outcomes that failed to record */
  failureCount: number
  /** The evidence that triggered recording */
  evidence?: EvidenceResult
  /** Summary message for logging */
  summary: string
}

/**
 * Handle bash output for evidence-based outcome recording
 * 
 * Phase 8: Parses bash output for success/failure signals and
 * auto-records outcomes for all pending memories.
 * 
 * @param mcp - MCP client instance
 * @param command - The bash command that was run
 * @param output - The bash command output (stdout/stderr combined)
 * @param exitCode - Exit code if available
 * @param state - Current session state
 * @returns Recording result with counts and summary
 */
export async function handleBashOutcome(
  mcp: Daem0nMcpClient,
  command: string,
  output: string,
  exitCode: number | undefined,
  state: SessionState
): Promise<OutcomeRecordingResult> {
  // Skip if no pending outcomes
  if (state.pendingOutcomeIds.size === 0) {
    return {
      recorded: false,
      successCount: 0,
      failureCount: 0,
      summary: "No pending outcomes to record",
    }
  }

  // Check if this looks like a test/build command
  if (!isTestOrBuildOutput(command, output)) {
    return {
      recorded: false,
      successCount: 0,
      failureCount: 0,
      summary: "Not a test/build command",
    }
  }

  // Detect evidence from output
  const evidence = detectEvidence(output)

  // Also check exit code if available
  if (exitCode !== undefined) {
    if (exitCode === 0 && !evidence.hasEvidence) {
      // Exit code 0 is weak success evidence
      evidence.hasEvidence = true
      evidence.worked = true
      evidence.summary = "Exit code 0"
      evidence.confidence = "medium"
    } else if (exitCode !== 0 && !evidence.hasEvidence) {
      // Non-zero exit code is stronger failure evidence
      evidence.hasEvidence = true
      evidence.worked = false
      evidence.summary = `Exit code ${exitCode}`
      evidence.confidence = "high"
    }
  }

  // Only record if we have clear evidence (not inconclusive)
  if (!evidence.hasEvidence || evidence.worked === null) {
    return {
      recorded: false,
      successCount: 0,
      failureCount: 0,
      evidence,
      summary: "No clear evidence - outcomes not auto-recorded",
    }
  }

  // Only record on high/medium confidence
  if (evidence.confidence === "low") {
    console.log(`[Daem0nMCP] Low confidence evidence, skipping auto-record: ${evidence.summary}`)
    return {
      recorded: false,
      successCount: 0,
      failureCount: 0,
      evidence,
      summary: "Low confidence evidence - skipped",
    }
  }

  // Record outcomes for all pending memories
  const pendingIds = Array.from(state.pendingOutcomeIds)
  console.log(`[Daem0nMCP] Recording outcomes for ${pendingIds.length} pending memories: ${evidence.summary}`)

  const result = await mcp.recordOutcomesBatch(
    pendingIds,
    evidence.summary,
    evidence.worked,
    3000
  )

  // Clear pending IDs that were successfully recorded
  for (const id of result.succeeded) {
    state.pendingOutcomeIds.delete(id)
  }

  const totalRecorded = result.succeeded.length
  const totalFailed = result.failed.length

  console.log(
    `[Daem0nMCP] Outcomes recorded: ${totalRecorded} succeeded, ${totalFailed} failed, ` +
    `${state.pendingOutcomeIds.size} remaining pending`
  )

  return {
    recorded: totalRecorded > 0,
    successCount: totalRecorded,
    failureCount: totalFailed,
    evidence,
    summary: `Recorded ${totalRecorded} outcome(s): ${evidence.worked ? "SUCCESS" : "FAILURE"} - ${evidence.summary}`,
  }
}

/**
 * Format outcome recording result for injection
 */
export function formatOutcomeResult(result: OutcomeRecordingResult): string | null {
  if (!result.recorded) {
    return null
  }

  const status = result.evidence?.worked ? "SUCCESS" : "FAILURE"
  return `[Daem0n auto-recorded] ${result.successCount} outcome(s) as ${status}
Evidence: ${result.evidence?.summary || "unknown"}
${result.failureCount > 0 ? `(${result.failureCount} failed to record)` : ""}`
}

/**
 * Get pending outcome statistics
 */
export function getPendingStats(state: SessionState): {
  count: number
  ids: number[]
  shouldRemind: boolean
} {
  const ids = Array.from(state.pendingOutcomeIds)
  return {
    count: ids.length,
    ids: ids.slice(0, 10),
    shouldRemind: ids.length > 0 && !state.outcomeReminderShown,
  }
}

/**
 * Check if we should try to record outcomes based on output
 */
export function shouldTryRecordOutcome(
  command: string,
  output: string,
  state: SessionState
): boolean {
  // Must have pending outcomes
  if (state.pendingOutcomeIds.size === 0) {
    return false
  }

  // Must look like a test/build command
  return isTestOrBuildOutput(command, output)
}
