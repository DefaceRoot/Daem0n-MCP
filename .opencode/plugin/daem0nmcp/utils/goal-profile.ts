/**
 * Goal Profile Processor
 * 
 * Phase 3 Implementation:
 * Deterministic extraction of goals/keywords/domains from user prompts.
 * No LLM calls - pure algorithmic processing.
 * 
 * Algorithm:
 * 1. Remove code blocks
 * 2. Tokenize lowercase alphanumerics
 * 3. Keep tokens len>=4; drop stopwords
 * 4. Domain detectors for common areas
 * 5. focusAreas = domains + top 3 keywords
 */

import type { GoalProfile } from "../types"

/** Common English stopwords to filter out */
const STOPWORDS = new Set([
  "that", "this", "with", "from", "have", "been", "were", "being", "their",
  "them", "they", "what", "when", "where", "which", "while", "about", "after",
  "before", "between", "both", "each", "every", "into", "more", "most", "only",
  "other", "over", "same", "some", "such", "than", "then", "there", "these",
  "those", "through", "under", "very", "want", "will", "would", "could", "should",
  "just", "also", "like", "make", "made", "need", "please", "help", "using",
  "used", "work", "working", "create", "creating", "implement", "implementing",
  "change", "changing", "update", "updating", "modify", "modifying", "look",
  "looking", "find", "finding", "check", "checking", "sure", "good", "well",
  "does", "done", "doing", "able", "first", "last", "next", "because", "since",
  "can't", "don't", "doesn't", "didn't", "won't", "wouldn't", "couldn't", "shouldn't",
  "here", "there", "something", "anything", "nothing", "everything", "want",
])

/** Domain detection patterns */
const DOMAIN_DETECTORS: Record<string, string[]> = {
  auth: [
    "auth", "jwt", "oauth", "token", "password", "secret", "credential",
    "login", "logout", "session", "permission", "role", "access", "identity",
    "authenticate", "authorize", "security", "bearer", "refresh"
  ],
  db: [
    "database", "sql", "schema", "migration", "postgres", "sqlite", "mysql",
    "model", "table", "column", "query", "index", "foreign", "primary",
    "prisma", "sequelize", "typeorm", "drizzle", "mongodb", "redis"
  ],
  api: [
    "api", "route", "endpoint", "http", "request", "response", "rest",
    "graphql", "grpc", "websocket", "fetch", "axios", "middleware",
    "controller", "handler", "service", "client", "server"
  ],
  test: [
    "test", "pytest", "jest", "mocha", "vitest", "cypress", "playwright",
    "build", "lint", "eslint", "coverage", "spec", "assert", "mock",
    "stub", "fixture", "e2e", "unit", "integration"
  ],
  config: [
    "config", "settings", "env", "dotenv", "environment", "variable",
    "yaml", "json", "toml", "ini", "configure", "setup", "option"
  ],
  frontend: [
    "react", "vue", "angular", "svelte", "component", "hook", "state",
    "props", "render", "dom", "css", "style", "tailwind", "sass", "scss",
    "html", "jsx", "tsx", "template", "layout", "page", "view"
  ],
  backend: [
    "express", "fastapi", "django", "flask", "nest", "spring", "rails",
    "server", "backend", "microservice", "queue", "worker", "cron", "job"
  ],
}

/** Code block pattern (to remove before tokenization) */
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const INLINE_CODE_PATTERN = /`[^`]+`/g

/**
 * Remove code blocks and inline code from text
 */
function removeCodeBlocks(text: string): string {
  return text
    .replace(CODE_BLOCK_PATTERN, " ")
    .replace(INLINE_CODE_PATTERN, " ")
}

/**
 * Tokenize text into lowercase alphanumeric tokens
 * Only keeps tokens with length >= 4
 */
function tokenize(text: string): string[] {
  const cleaned = removeCodeBlocks(text)
  // Split on non-alphanumeric, keep only words >= 4 chars
  const tokens = cleaned
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 4)
    .filter(token => !STOPWORDS.has(token))
  
  return tokens
}

/**
 * Count token frequencies
 */
function countTokens(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return counts
}

/**
 * Detect domains from tokens
 */
function detectDomains(tokens: string[]): Set<string> {
  const tokenSet = new Set(tokens)
  const domains = new Set<string>()

  for (const [domain, keywords] of Object.entries(DOMAIN_DETECTORS)) {
    // Check if any domain keywords are present
    const matches = keywords.filter(kw => {
      // Check for exact match or substring presence
      return tokenSet.has(kw) || tokens.some(t => t.includes(kw) || kw.includes(t))
    })

    // Require at least 1 keyword match to assign domain
    if (matches.length >= 1) {
      domains.add(domain)
    }
  }

  return domains
}

/**
 * Get top N keywords by frequency (excluding domain keywords)
 */
function getTopKeywords(
  tokenCounts: Map<string, number>,
  domains: Set<string>,
  limit: number = 3
): string[] {
  // Get all domain keywords to exclude
  const domainKeywords = new Set<string>()
  for (const domain of domains) {
    const keywords = DOMAIN_DETECTORS[domain] || []
    keywords.forEach(kw => domainKeywords.add(kw))
  }

  // Sort tokens by frequency, excluding domain keywords
  const sortedTokens = Array.from(tokenCounts.entries())
    .filter(([token]) => !domainKeywords.has(token))
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)

  return sortedTokens.slice(0, limit)
}

/**
 * Create a goal profile from a user prompt
 * 
 * @param prompt The user's message text
 * @returns GoalProfile with keywords, domains, and focus areas
 */
export function createGoalProfile(prompt: string): GoalProfile {
  const tokens = tokenize(prompt)
  const tokenCounts = countTokens(tokens)
  const domains = detectDomains(tokens)
  const topKeywords = getTopKeywords(tokenCounts, domains, 3)

  // Create unique keywords set
  const keywords = new Set(tokens)

  // Focus areas = domains + top keywords
  const focusAreas = [
    ...Array.from(domains),
    ...topKeywords.filter(kw => !domains.has(kw)),
  ].slice(0, 5) // Cap at 5 focus areas

  return {
    keywords,
    domains,
    focusAreas,
  }
}

/**
 * Merge two goal profiles (for multi-message analysis)
 */
export function mergeGoalProfiles(a: GoalProfile, b: GoalProfile): GoalProfile {
  const keywords = new Set([...a.keywords, ...b.keywords])
  const domains = new Set([...a.domains, ...b.domains])
  
  // Combine focus areas, dedupe, cap at 5
  const combinedFocusAreas = [...new Set([...a.focusAreas, ...b.focusAreas])]
  const focusAreas = combinedFocusAreas.slice(0, 5)

  return { keywords, domains, focusAreas }
}

/**
 * Check if a memory's tags/content intersects with a goal profile
 */
export function matchesGoalProfile(
  memoryTags: string[],
  memoryContent: string,
  profile: GoalProfile
): boolean {
  // Check tag intersection
  const tagSet = new Set(memoryTags.map(t => t.toLowerCase()))
  for (const domain of profile.domains) {
    if (tagSet.has(domain)) return true
  }
  for (const keyword of profile.keywords) {
    if (tagSet.has(keyword)) return true
  }

  // Check content keyword match (case-insensitive)
  const contentLower = memoryContent.toLowerCase()
  for (const keyword of profile.focusAreas) {
    if (contentLower.includes(keyword)) return true
  }

  return false
}

/**
 * Get a summary string for the goal profile (for context_check description)
 */
export function summarizeGoalProfile(profile: GoalProfile): string {
  const parts: string[] = []

  if (profile.domains.size > 0) {
    parts.push(`domains: ${Array.from(profile.domains).join(", ")}`)
  }

  if (profile.focusAreas.length > 0) {
    parts.push(`focus: ${profile.focusAreas.join(", ")}`)
  }

  return parts.join(" | ") || "general task"
}

/**
 * Check if a goal profile is empty/trivial
 */
export function isEmptyProfile(profile: GoalProfile): boolean {
  return profile.keywords.size === 0 && 
         profile.domains.size === 0 && 
         profile.focusAreas.length === 0
}
