export interface ExtractedDecision {
  category: "decision" | "pattern" | "warning" | "learning"
  content: string
  filePath?: string
}

export const COMPLETION_PATTERNS = [
  /\ball\s+(?:tasks?|todos?|items?)\s+(?:are\s+)?(?:complete|done|finished)\b/i,
  /\bcompleted?\s+all\s+(?:tasks?|todos?|items?)\b/i,
  /\bmarking\s+.*\s+as\s+completed?\b/i,
  /\btask\s+(?:is\s+)?(?:complete|done|finished)\b/i,
  /\bimplementation\s+(?:is\s+)?(?:complete|done|finished)\b/i,
  /\bsuccessfully\s+(?:implemented|completed|finished)\b/i,
  /\bwork\s+(?:is\s+)?(?:complete|done|finished)\b/i,
  /\bchanges?\s+(?:have\s+been\s+)?(?:committed|pushed)\b/i,
  /\bpull\s+request\s+(?:created|opened)\b/i,
  /\bfeature\s+(?:is\s+)?(?:complete|ready|done)\b/i,
  /\bbug\s+(?:fix\s+)?(?:is\s+)?(?:complete|done|deployed)\b/i,
]

export const DAEM0N_OUTCOME_PATTERNS = [
  /mcp__daem0nmcp__record_outcome/i,
  /record_outcome/i,
  /recorded?\s+(?:the\s+)?outcome/i,
  /outcome\s+(?:has\s+been\s+)?recorded/i,
]

export const EXPLORATION_PATTERNS = [
  /\bhere(?:'s|\s+is)\s+(?:the\s+)?(?:information|answer|explanation)\b/i,
  /\bi\s+found\b/i,
  /\blet\s+me\s+explain\b/i,
  /\bthe\s+(?:code|file|function)\s+(?:is|does|works)\b/i,
  /\bbased\s+on\s+my\s+(?:research|analysis|exploration)\b/i,
]

export const DECISION_PATTERNS: Array<{ pattern: RegExp; category: ExtractedDecision["category"] }> = [
  { pattern: /(?:i(?:'ll|'m going to| will| decided to))\s+(?:use|implement|add|create|choose)\s+(.{20,150})/i, category: "decision" },
  { pattern: /(?:chose|selected|picked|went with)\s+(.{20,100})\s+(?:because|since|for)/i, category: "decision" },
  { pattern: /(?:the (?:best|right|correct) (?:approach|solution|way) is)\s+(.{20,150})/i, category: "decision" },
  { pattern: /(?:pattern|approach|convention):\s*(.{20,150})/i, category: "pattern" },
  { pattern: /(?:warning|caution|avoid|don't|do not):\s*(.{20,150})/i, category: "warning" },
  { pattern: /(?:learned|discovered|found out|realized)\s+(?:that\s+)?(.{20,150})/i, category: "learning" },
]

export const FILE_MENTION_PATTERN = /(?:in|to|from|at|file)\s+[`'"]?([a-zA-Z0-9_/.-]+\.[a-zA-Z0-9]+)[`'"]?/i

/** Phase 7: Extract all file mentions from text */
export function extractFileMentions(text: string): string[] {
  const mentions: Set<string> = new Set()
  const pattern = /[`'"]?([a-zA-Z0-9_/.-]+\.(?:py|ts|js|tsx|jsx|go|rs|java|rb|php|yaml|yml|json|toml|sql|md))[`'"]?/gi
  
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const filePath = match[1]
    // Skip common false positives
    if (!filePath.match(/^[0-9.]+$/) && filePath.length > 3) {
      mentions.add(filePath)
    }
  }
  
  return Array.from(mentions)
}

export function hasCompletionSignal(text: string): boolean {
  return COMPLETION_PATTERNS.some(pattern => pattern.test(text))
}

export function hasOutcomeRecorded(text: string, toolCalls: string[] = []): boolean {
  if (toolCalls.some(tool => tool.toLowerCase().includes("record_outcome"))) {
    return true
  }
  return DAEM0N_OUTCOME_PATTERNS.some(pattern => pattern.test(text))
}

export function isExplorationOnly(text: string): boolean {
  return EXPLORATION_PATTERNS.some(pattern => pattern.test(text))
}

export function extractDecisions(text: string, maxDecisions: number = 5): ExtractedDecision[] {
  const decisions: ExtractedDecision[] = []
  const seenContent = new Set<string>()

  for (const { pattern, category } of DECISION_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern, "gi"))
    
    for (const match of matches) {
      let content = match[1]?.trim()
      if (!content || content.length < 20) continue

      content = content.replace(/\s+/g, " ").replace(/[.,;:]+$/, "")
      
      const normalizedContent = content.toLowerCase()
      if (seenContent.has(normalizedContent)) continue
      seenContent.add(normalizedContent)

      const contextStart = Math.max(0, (match.index || 0) - 200)
      const contextEnd = (match.index || 0) + match[0].length + 200
      const contextWindow = text.slice(contextStart, contextEnd)
      
      const fileMatch = FILE_MENTION_PATTERN.exec(contextWindow)
      const filePath = fileMatch?.[1]

      decisions.push({
        category,
        content: content.slice(0, 200),
        filePath,
      })

      if (decisions.length >= maxDecisions) break
    }

    if (decisions.length >= maxDecisions) break
  }

  return decisions
}

/**
 * Phase 8: Evidence detection result
 */
export interface EvidenceResult {
  hasEvidence: boolean
  worked: boolean | null  // null = inconclusive
  summary: string
  confidence: "high" | "medium" | "low"
}

/** Success patterns for bash output (Phase 8) */
const SUCCESS_PATTERNS = [
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

/** Failure patterns for bash output (Phase 8) */
const FAILURE_PATTERNS = [
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
  /build\s+failed/i,
]

/**
 * Detect evidence of success or failure from bash output
 * 
 * Phase 8: Parse bash output for strong success/failure signals
 * Used for automatic outcome recording
 */
export function detectEvidence(output: string): EvidenceResult {
  if (!output || output.length < 10) {
    return { hasEvidence: false, worked: null, summary: "", confidence: "low" }
  }

  // Count success and failure signals
  let successCount = 0
  let failureCount = 0
  const successMatches: string[] = []
  const failureMatches: string[] = []

  for (const pattern of SUCCESS_PATTERNS) {
    const match = pattern.exec(output)
    if (match) {
      successCount++
      successMatches.push(match[0].slice(0, 30))
    }
  }

  for (const pattern of FAILURE_PATTERNS) {
    const match = pattern.exec(output)
    if (match) {
      failureCount++
      failureMatches.push(match[0].slice(0, 30))
    }
  }

  // Determine outcome based on evidence
  if (failureCount > 0 && successCount === 0) {
    // Clear failure
    return {
      hasEvidence: true,
      worked: false,
      summary: `Failed: ${failureMatches.slice(0, 2).join(", ")}`,
      confidence: failureCount >= 2 ? "high" : "medium",
    }
  }

  if (successCount > 0 && failureCount === 0) {
    // Clear success
    return {
      hasEvidence: true,
      worked: true,
      summary: `Success: ${successMatches.slice(0, 2).join(", ")}`,
      confidence: successCount >= 2 ? "high" : "medium",
    }
  }

  if (successCount > 0 && failureCount > 0) {
    // Mixed signals - be conservative, report failure
    if (failureCount > successCount) {
      return {
        hasEvidence: true,
        worked: false,
        summary: `Mixed but more failures: ${failureMatches[0]}`,
        confidence: "low",
      }
    }
    // Don't auto-record on mixed signals with more successes
    return { hasEvidence: false, worked: null, summary: "Mixed signals", confidence: "low" }
  }

  // No evidence
  return { hasEvidence: false, worked: null, summary: "", confidence: "low" }
}

/**
 * Check if output appears to be from a test/build command
 */
export function isTestOrBuildOutput(command: string, output: string): boolean {
  const testBuildPatterns = [
    /\bpytest\b/i,
    /\bjest\b/i,
    /\bmocha\b/i,
    /\bvitest\b/i,
    /\bnpm\s+(run\s+)?test\b/i,
    /\byarn\s+test\b/i,
    /\bgo\s+test\b/i,
    /\bcargo\s+test\b/i,
    /\bmake\s+test\b/i,
    /\bnpm\s+run\s+build\b/i,
    /\byarn\s+build\b/i,
    /\bcargo\s+build\b/i,
    /\btsc\b/i,
    /\bcompile\b/i,
    /\bbuild\b/i,
  ]
  
  const combined = `${command} ${output}`.toLowerCase()
  return testBuildPatterns.some(p => p.test(combined))
}
