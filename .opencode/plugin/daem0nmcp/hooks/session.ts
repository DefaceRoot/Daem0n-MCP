/**
 * Session Hooks - Handle session lifecycle events
 * 
 * Ported from:
 * - hooks/daem0n_prompt_hook.py (session start reminder)
 * - hooks/daem0n_stop_hook.py (completion detection, outcome reminders)
 * 
 * Phase 2: Auto-briefing on session.created
 * - Automatically calls get_briefing()
 * - Creates bounded digest for injection
 * - Sets briefed=true, briefedAt timestamp
 * 
 * Phase 7: Completion-time decision extraction
 * - Extracts decisions from agent responses at session.idle
 * - Applies relevance gating (goalProfile OR modified files)
 * - Tracks memory IDs in pendingOutcomeIds
 * - Once-per-session reminder policy
 */

import type { SessionState, BriefingDigest, GoalProfile, CompactionContext } from "../types"
import { 
  MAX_EXTRACTED_DECISIONS,
  COMPACTION_MAX_MODIFIED_FILES,
  COMPACTION_MAX_FOCUS_AREAS,
} from "../types"
import type { Daem0nMcpClient } from "../utils/mcp-client"
import {
  hasCompletionSignal,
  hasOutcomeRecorded,
  isExplorationOnly,
  extractDecisions,
  extractFileMentions,
  type ExtractedDecision,
} from "../utils/patterns"
import { createBriefingDigest, hasDigestContent, getDigestStats } from "../utils/digest"

/**
 * Output structure for session hooks
 */
export interface SessionHookOutput {
  message?: string
  context?: string | string[]
}

/**
 * Result from auto-briefing
 */
export interface AutoBriefingResult {
  success: boolean
  digest?: BriefingDigest
  error?: string
}

/**
 * Handle session.created event
 * 
 * Phase 2: Auto-briefing implementation
 * - Automatically calls get_briefing() on session start
 * - Creates bounded digest for context injection
 * - Sets briefed=true with timestamp
 * 
 * This replaces the manual reminder with automatic action.
 */
export async function handleSessionCreated(
  mcp: Daem0nMcpClient,
  state: SessionState,
  output: SessionHookOutput
): Promise<AutoBriefingResult> {
  // Reset state for new session (preserve serverStatus and offlineLogged)
  const serverStatus = state.serverStatus
  const offlineLogged = state.offlineLogged
  state.briefed = false
  state.briefedAt = undefined
  state.briefingDigest = undefined
  state.contextChecks = []
  state.modifiedFiles.clear()
  state.serverStatus = serverStatus
  state.offlineLogged = offlineLogged
  state.digestInjected = false
  state.pendingOutcomeIds = new Set()
  state.dedupe = new Set()
  state.rootUserPrompt = undefined
  state.goalProfile = undefined
  state.lastUserPromptAt = undefined

  // Skip auto-briefing if server is offline
  if (state.serverStatus === "offline") {
    return { success: false, error: "Server offline" }
  }

  // Auto-call get_briefing with timeout
  console.log("[Daem0nMCP] Auto-briefing: calling get_briefing()...")
  
  try {
    const briefingResult = await mcp.getBriefingWithTimeout(undefined, 5000)

    if (!briefingResult.success || !briefingResult.data) {
      console.warn("[Daem0nMCP] Auto-briefing failed:", briefingResult.error)
      
      // Fall back to manual reminder
      output.message = `[Daem0n awakens] Auto-briefing failed (${briefingResult.error}). 

Please manually call mcp__daem0nmcp__get_briefing() to receive your memories.

The Sacred Covenant still applies - mutating tools may be blocked until briefed.`

      return { success: false, error: briefingResult.error }
    }

    // Create bounded digest from briefing response
    const digest = createBriefingDigest(briefingResult.data)
    const stats = getDigestStats(digest)
    
    console.log(
      `[Daem0nMCP] Auto-briefing complete: ` +
      `${stats.warningCount} warnings, ${stats.failedCount} failed, ${stats.decisionCount} decisions ` +
      `(${stats.formattedLength} chars)`
    )

    // Update state
    state.briefed = true
    state.briefedAt = new Date()
    state.briefingDigest = digest

    // Only inject if there's meaningful content
    if (hasDigestContent(digest)) {
      output.message = digest.formatted
      output.context = [digest.formatted]
    } else {
      // Still mark as briefed, just no critical context to inject
      output.message = `[Daem0n briefed] Session initialized. No critical warnings or failed approaches found.

Stats: ${briefingResult.data.stats.total_memories} memories, ${briefingResult.data.stats.rules} rules.

The covenant is satisfied. Remember to:
- Call context_check() before significant changes
- Call remember() to record decisions
- Call record_outcome() when done`
    }

    return { success: true, digest }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error"
    console.error("[Daem0nMCP] Auto-briefing exception:", errorMsg)

    // Fall back to manual reminder on any error
    output.message = `[Daem0n awakens] Auto-briefing error: ${errorMsg}

Please manually call mcp__daem0nmcp__get_briefing() to receive your memories.`

    return { success: false, error: errorMsg }
  }
}

/**
 * Phase 7: Check if an extracted decision is relevant to the current goal
 * 
 * Relevance gating - only remember if:
 * 1. Decision content intersects with goalProfile keywords/domains
 * 2. Decision mentions a file that was modified in this session
 * 3. Decision's file path matches a modified file
 */
function isRelevantDecision(
  decision: ExtractedDecision,
  goalProfile?: GoalProfile,
  modifiedFiles?: Map<string, unknown>
): boolean {
  // If no goal profile and no modified files, accept everything
  if (!goalProfile && (!modifiedFiles || modifiedFiles.size === 0)) {
    return true
  }

  const contentLower = decision.content.toLowerCase()

  // Check if decision mentions a modified file
  if (modifiedFiles && modifiedFiles.size > 0) {
    // Check if decision's explicit file path matches
    if (decision.filePath) {
      const normalizedPath = decision.filePath.replace(/\\/g, "/")
      for (const modPath of modifiedFiles.keys()) {
        const normalizedModPath = modPath.replace(/\\/g, "/")
        if (normalizedPath.includes(normalizedModPath) || 
            normalizedModPath.includes(normalizedPath)) {
          return true
        }
      }
    }

    // Check if content mentions any modified file names
    for (const modPath of modifiedFiles.keys()) {
      const fileName = modPath.split(/[/\\]/).pop()?.toLowerCase() || ""
      if (fileName && contentLower.includes(fileName)) {
        return true
      }
    }
  }

  // Check goal profile keywords/domains
  if (goalProfile) {
    // Check domains
    for (const domain of goalProfile.domains) {
      if (contentLower.includes(domain.toLowerCase())) {
        return true
      }
    }

    // Check focus areas
    for (const focus of goalProfile.focusAreas) {
      if (contentLower.includes(focus.toLowerCase())) {
        return true
      }
    }

    // Check top keywords (only significant ones, length >= 5)
    const significantKeywords = Array.from(goalProfile.keywords)
      .filter(k => k.length >= 5)
      .slice(0, 10)
    
    for (const keyword of significantKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return true
      }
    }
  }

  // Not relevant enough
  return false
}

/**
 * Handle session.idle event (when agent finishes responding)
 * 
 * Phase 7: Completion-time decision extraction with:
 * - Relevance gating (goalProfile OR modified files)
 * - Memory ID tracking in pendingOutcomeIds
 * - Once-per-session reminder policy
 * 
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
    // Even without completion signal, if we have pending outcomes and haven't reminded yet
    // show a reminder (but only once)
    if (state.pendingOutcomeIds.size > 0 && !state.outcomeReminderShown) {
      // Don't show reminder here - wait for completion signal
      return null
    }
    return null
  }

  // Check if outcome was already recorded
  if (hasOutcomeRecorded(recentContent, recentToolCalls)) {
    return null
  }

  // Try to extract decisions from the response
  const allExtracted = extractDecisions(recentContent, MAX_EXTRACTED_DECISIONS)

  // Phase 7: Apply relevance gating
  const relevantDecisions = allExtracted.filter(d => 
    isRelevantDecision(d, state.goalProfile, state.modifiedFiles)
  )

  console.log(`[Daem0nMCP] Session idle: ${allExtracted.length} extracted, ${relevantDecisions.length} relevant`)

  if (relevantDecisions.length > 0) {
    // Auto-remember relevant decisions
    const memoryIds: number[] = []
    const createdDecisions: ExtractedDecision[] = []

    for (const decision of relevantDecisions) {
      try {
        const result = await mcp.rememberWithTimeout({
          category: decision.category,
          content: decision.content,
          rationale: "Auto-captured from conversation completion",
          filePath: decision.filePath,
          tags: ["auto-extracted", "completion"],
        }, 5000)

        if (result.success && result.data?.id) {
          const memId = result.data.id
          memoryIds.push(memId)
          createdDecisions.push(decision)
          
          // Phase 7: Track in pendingOutcomeIds
          state.pendingOutcomeIds.add(memId)
        }
      } catch (err) {
        // Continue on error - don't block on auto-capture failures
        console.warn(`[Daem0nMCP] Failed to auto-remember decision:`, err)
      }
    }

    if (memoryIds.length > 0) {
      const decisionSummary = createdDecisions
        .slice(0, 3)
        .map(d => `  - [${d.category}] ${d.content.slice(0, 80)}...`)
        .join("\n")

      // Phase 7: Mark reminder shown to enforce once-per-session policy
      state.outcomeReminderShown = true

      return `[Daem0n auto-captured] ${memoryIds.length} decision(s) from task completion:
${decisionSummary}

Memory IDs: ${memoryIds.join(", ")}
Pending outcomes: ${state.pendingOutcomeIds.size}

Run tests/build to auto-record outcomes, or manually call record_outcome().`
    }
  }

  // Phase 7: Once-per-session reminder policy
  // Only show reminder if we have pending outcomes AND haven't shown reminder yet
  if (state.pendingOutcomeIds.size > 0 && !state.outcomeReminderShown) {
    state.outcomeReminderShown = true
    
    const pendingIds = Array.from(state.pendingOutcomeIds).slice(0, 5)
    return `[Daem0n whispers] Task completed with ${state.pendingOutcomeIds.size} pending outcome(s).

Memory IDs awaiting outcomes: ${pendingIds.join(", ")}${state.pendingOutcomeIds.size > 5 ? "..." : ""}

Run tests/build → outcomes auto-recorded
Or manually: mcp__daem0nmcp__record_outcome(memory_id, outcome, worked)`
  }

  // Completion detected but no decisions extracted and no pending outcomes
  // Skip reminder if we already showed one this session
  if (state.outcomeReminderShown) {
    return null
  }

  return null
}

/**
 * Phase 9: Create structured compaction context from session state
 * 
 * Extracts all critical state that must survive compaction for
 * the plugin to continue functioning correctly.
 */
export function createCompactionContext(state: SessionState): CompactionContext {
  // Get most recent counsel topic
  const lastCounsel = state.contextChecks.length > 0
    ? state.contextChecks[state.contextChecks.length - 1]
    : undefined

  // Get modified files (limited to max 5)
  const modifiedFiles = Array.from(state.modifiedFiles.keys())
    .slice(0, COMPACTION_MAX_MODIFIED_FILES)

  // Create goal summary if profile exists
  const goalSummary = state.goalProfile
    ? {
        domains: Array.from(state.goalProfile.domains).slice(0, COMPACTION_MAX_FOCUS_AREAS),
        focusAreas: state.goalProfile.focusAreas.slice(0, COMPACTION_MAX_FOCUS_AREAS),
      }
    : undefined

  return {
    serverStatus: state.serverStatus,
    briefed: state.briefed,
    briefedAt: state.briefedAt?.toISOString(),
    counselCheckCount: state.contextChecks.length,
    lastCounselTopic: lastCounsel?.topic,
    pendingOutcomeCount: state.pendingOutcomeIds.size,
    pendingOutcomeIds: Array.from(state.pendingOutcomeIds).slice(0, 10),
    modifiedFiles,
    goalSummary,
    digestInjected: state.digestInjected,
    outcomeReminderShown: state.outcomeReminderShown,
  }
}

/**
 * Phase 9: Format compaction context as human-readable strings
 * 
 * Converts structured context into injection-ready format that
 * both the LLM and plugin can understand.
 */
export function formatCompactionContext(ctx: CompactionContext): string[] {
  const lines: string[] = []

  // Header
  lines.push("[Daem0n-MCP State Preserved]")
  lines.push("")

  // Server status
  lines.push(`Server: ${ctx.serverStatus}`)

  // Covenant state
  if (ctx.briefed) {
    lines.push(`Covenant: Communion COMPLETE${ctx.briefedAt ? ` (${ctx.briefedAt})` : ""}`)
  } else {
    lines.push("Covenant: Communion PENDING - call get_briefing() before mutating")
  }

  // Counsel state
  if (ctx.counselCheckCount > 0) {
    lines.push(`Counsel: ${ctx.counselCheckCount} check(s) performed`)
    if (ctx.lastCounselTopic) {
      lines.push(`  Last topic: "${ctx.lastCounselTopic}"`)
    }
  } else {
    lines.push("Counsel: No context checks performed yet")
  }

  // Pending outcomes
  if (ctx.pendingOutcomeCount > 0) {
    lines.push(`Pending Outcomes: ${ctx.pendingOutcomeCount} memory ID(s) awaiting record_outcome()`)
    if (ctx.pendingOutcomeIds.length > 0) {
      lines.push(`  IDs: ${ctx.pendingOutcomeIds.join(", ")}`)
    }
  }

  // Modified files
  if (ctx.modifiedFiles.length > 0) {
    lines.push(`Modified Files (${ctx.modifiedFiles.length}):`)
    for (const file of ctx.modifiedFiles) {
      lines.push(`  - ${file}`)
    }
  }

  // Goal profile
  if (ctx.goalSummary) {
    if (ctx.goalSummary.domains.length > 0 || ctx.goalSummary.focusAreas.length > 0) {
      lines.push(`Goal Profile:`)
      if (ctx.goalSummary.domains.length > 0) {
        lines.push(`  Domains: ${ctx.goalSummary.domains.join(", ")}`)
      }
      if (ctx.goalSummary.focusAreas.length > 0) {
        lines.push(`  Focus: ${ctx.goalSummary.focusAreas.join(", ")}`)
      }
    }
  }

  // State flags
  const flags: string[] = []
  if (ctx.digestInjected) flags.push("digest-injected")
  if (ctx.outcomeReminderShown) flags.push("reminder-shown")
  if (flags.length > 0) {
    lines.push(`Flags: ${flags.join(", ")}`)
  }

  lines.push("")
  lines.push("[Memory system continues enforcing automatically]")

  return lines
}

/**
 * Handle experimental.session.compacting event
 * 
 * Phase 9: Compaction survival implementation
 * 
 * Injects comprehensive state context during context window compaction
 * to ensure the plugin continues enforcing and remembering correctly.
 * 
 * Preserved state:
 * - Server online/offline status
 * - Briefed true/false (communion complete)
 * - Number of counsel checks
 * - Number of pending outcomes
 * - Modified files (max 5)
 * - Goal profile summary for relevance routing
 * - State flags (digest injected, reminder shown)
 */
export function handleSessionCompacting(
  state: SessionState
): string[] | null {
  // Always inject compaction context, even if not briefed
  // This ensures the agent knows the current state
  const ctx = createCompactionContext(state)
  
  // If server is offline, inject minimal context
  if (ctx.serverStatus === "offline") {
    return [
      "[Daem0n-MCP] Server offline - memory automation inactive",
      "The memory system will resume when the server becomes available.",
    ]
  }

  return formatCompactionContext(ctx)
}
