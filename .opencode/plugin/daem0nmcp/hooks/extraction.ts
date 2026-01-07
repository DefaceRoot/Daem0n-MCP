/**
 * Decision Extraction - Auto-capture decisions from agent responses
 * 
 * Ported from: hooks/daem0n_stop_hook.py (extract_decisions, auto_remember_decisions)
 * 
 * Features:
 * - Extracts decisions, patterns, warnings, learnings from text
 * - Associates decisions with mentioned file paths
 * - Auto-creates memories via MCP client
 */

import type { Daem0nMcpClient } from "../utils/mcp-client"
import { extractDecisions, type ExtractedDecision } from "../utils/patterns"

/**
 * Result of extraction and memory creation
 */
export interface ExtractionResult {
  memoryIds: number[]
  decisions: ExtractedDecision[]
  errors: string[]
}

/**
 * Extract decisions from text and auto-remember them
 * 
 * This is the main entry point for decision extraction.
 * It parses the text for decision patterns and creates memories.
 * 
 * @param mcp - MCP client instance
 * @param text - Text to extract decisions from (usually agent response)
 * @param maxDecisions - Maximum number of decisions to extract (default: 5)
 * @returns Extraction result with memory IDs and decision details
 */
export async function extractAndRememberDecisions(
  mcp: Daem0nMcpClient,
  text: string,
  maxDecisions: number = 5
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    memoryIds: [],
    decisions: [],
    errors: [],
  }

  // Extract decisions from text using patterns
  const extracted = extractDecisions(text, maxDecisions)
  result.decisions = extracted

  if (extracted.length === 0) {
    return result
  }

  // Auto-remember each extracted decision
  for (const decision of extracted) {
    try {
      const rememberResult = await mcp.remember({
        category: decision.category,
        content: decision.content,
        rationale: "Auto-captured from conversation",
        filePath: decision.filePath,
      })

      if (rememberResult.success && rememberResult.data?.id) {
        result.memoryIds.push(rememberResult.data.id)
      } else if (rememberResult.error) {
        result.errors.push(`Failed to remember "${decision.content.slice(0, 50)}...": ${rememberResult.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      result.errors.push(`Exception remembering "${decision.content.slice(0, 50)}...": ${errorMsg}`)
    }
  }

  return result
}

/**
 * Format extraction result as a human-readable summary
 */
export function formatExtractionSummary(result: ExtractionResult): string {
  if (result.memoryIds.length === 0) {
    if (result.errors.length > 0) {
      return `[Daem0n extraction failed] ${result.errors.length} error(s):\n${result.errors.slice(0, 3).join("\n")}`
    }
    return ""
  }

  const decisionSummary = result.decisions
    .slice(0, 3)
    .map(d => `  - [${d.category}] ${d.content.slice(0, 80)}...`)
    .join("\n")

  let message = `[Daem0n auto-captured] ${result.memoryIds.length} decision(s) from your response:
${decisionSummary}

Memory IDs: ${result.memoryIds.join(", ")}. Remember to record_outcome() when you know if they worked.`

  if (result.errors.length > 0) {
    message += `\n\n(${result.errors.length} extraction error(s) occurred)`
  }

  return message
}

/**
 * Check if text contains explicit decision statements
 * 
 * This is a lighter-weight check than full extraction,
 * useful for deciding whether to run full extraction.
 */
export function hasExplicitDecisions(text: string): boolean {
  // Quick patterns that indicate decisions were made
  const quickPatterns = [
    /i(?:'ll|'m going to| will| decided to)\s+(?:use|implement|add|create|choose)/i,
    /(?:chose|selected|picked|went with).+(?:because|since|for)/i,
    /(?:pattern|approach|convention):/i,
    /(?:warning|caution|avoid):/i,
    /(?:learned|discovered|realized)\s+that/i,
  ]

  return quickPatterns.some(p => p.test(text))
}

/**
 * Get the category breakdown of extracted decisions
 */
export function getCategoryBreakdown(decisions: ExtractedDecision[]): Record<string, number> {
  const breakdown: Record<string, number> = {
    decision: 0,
    pattern: 0,
    warning: 0,
    learning: 0,
  }

  for (const d of decisions) {
    breakdown[d.category]++
  }

  return breakdown
}
