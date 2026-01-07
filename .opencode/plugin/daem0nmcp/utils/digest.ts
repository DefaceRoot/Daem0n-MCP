/**
 * Briefing Digest Formatter
 * 
 * Creates bounded, relevance-focused digests from full briefing responses.
 * 
 * Phase 2 Implementation:
 * - Extract max 3 active warnings
 * - Extract max 3 failed approaches
 * - Extract max 3 recent decisions
 * - Never include full memory bodies
 * - Format as compact, injectable string
 */

import type { BriefingResponse, BriefingDigest, Memory } from "../types"

/** Maximum items per category in digest */
const MAX_WARNINGS = 3
const MAX_FAILED_APPROACHES = 3
const MAX_RECENT_DECISIONS = 3

/** Maximum content length per item (truncate beyond this) */
const MAX_CONTENT_LENGTH = 100

/**
 * Truncate content to max length with ellipsis
 */
function truncateContent(content: string, maxLength: number = MAX_CONTENT_LENGTH): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength - 3) + "..."
}

/**
 * Extract summary from a memory (content only, no rationale or context)
 */
function summarizeMemory(memory: Memory): string {
  const content = truncateContent(memory.content)
  const tags = memory.tags?.length > 0 ? ` [${memory.tags.slice(0, 3).join(", ")}]` : ""
  return `${content}${tags}`
}

/**
 * Format a list of items as bullet points
 */
function formatBulletList(title: string, items: string[]): string {
  if (items.length === 0) return ""
  const bullets = items.map(item => `  - ${item}`).join("\n")
  return `${title}:\n${bullets}`
}

/**
 * Create a briefing digest from a full briefing response
 * 
 * @param briefing Full briefing response from get_briefing()
 * @returns BriefingDigest with extracted and formatted content
 */
export function createBriefingDigest(briefing: BriefingResponse): BriefingDigest {
  // Extract warnings (max 3)
  const warnings = (briefing.active_warnings || [])
    .slice(0, MAX_WARNINGS)
    .map(summarizeMemory)

  // Extract failed approaches (max 3) - these are memories with worked=false
  const failedApproaches = (briefing.failed_approaches || [])
    .slice(0, MAX_FAILED_APPROACHES)
    .map(summarizeMemory)

  // Extract recent decisions (max 3)
  const recentDecisions = (briefing.recent_decisions || [])
    .slice(0, MAX_RECENT_DECISIONS)
    .map(summarizeMemory)

  // Format the digest
  const sections: string[] = []

  // Always include stats summary
  const stats = briefing.stats
  sections.push(
    `[Daem0n Briefing] Project: ${briefing.project_path}\n` +
    `Memories: ${stats.total_memories} (${stats.decisions}d/${stats.patterns}p/${stats.warnings}w/${stats.learnings}l) | Rules: ${stats.rules}`
  )

  // Add warnings if present (highest priority)
  if (warnings.length > 0) {
    sections.push(formatBulletList("WARNINGS", warnings))
  }

  // Add failed approaches if present (second priority)
  if (failedApproaches.length > 0) {
    sections.push(formatBulletList("FAILED APPROACHES (avoid repeating)", failedApproaches))
  }

  // Add recent decisions if present
  if (recentDecisions.length > 0) {
    sections.push(formatBulletList("Recent Decisions", recentDecisions))
  }

  // Add git changes if present
  if (briefing.git_changes && briefing.git_changes.length > 0) {
    const changes = briefing.git_changes.slice(0, 5)
    sections.push(formatBulletList("Git changes since last session", changes))
  }

  // Add active context if present
  if (briefing.active_context && briefing.active_context.length > 0) {
    const activeItems = briefing.active_context
      .slice(0, 3)
      .map(summarizeMemory)
    sections.push(formatBulletList("Active Context (hot memories)", activeItems))
  }

  const formatted = sections.join("\n\n")

  return {
    warnings,
    failedApproaches,
    recentDecisions,
    retrievedAt: new Date(),
    formatted,
  }
}

/**
 * Check if a digest has meaningful content worth injecting
 */
export function hasDigestContent(digest: BriefingDigest): boolean {
  return (
    digest.warnings.length > 0 ||
    digest.failedApproaches.length > 0 ||
    digest.recentDecisions.length > 0
  )
}

/**
 * Get the digest size for logging/debugging
 */
export function getDigestStats(digest: BriefingDigest): {
  warningCount: number
  failedCount: number
  decisionCount: number
  formattedLength: number
} {
  return {
    warningCount: digest.warnings.length,
    failedCount: digest.failedApproaches.length,
    decisionCount: digest.recentDecisions.length,
    formattedLength: digest.formatted.length,
  }
}
