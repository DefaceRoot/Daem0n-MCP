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
