import type { SessionState, CovenantViolation, ServerStatus, GoalProfile } from "./types"
import {
  COVENANT_EXEMPT_TOOLS,
  COMMUNION_REQUIRED_TOOLS,
  COUNSEL_REQUIRED_TOOLS,
  COUNSEL_TTL_MS,
  MUTATING_HOST_TOOLS,
} from "./types"

/**
 * Phase 4: Check if a tool is a mutating host tool that requires covenant enforcement
 */
export function isMutatingHostTool(toolName: string): boolean {
  return MUTATING_HOST_TOOLS.has(toolName)
}

/**
 * Phase 4: Check if hard mode is enabled (throws instead of auto-fixing)
 * Default: false (auto-fix mode)
 */
export function isHardModeEnabled(): boolean {
  return process.env.DAEM0NMCP_HARD_MODE === "true" || process.env.DAEM0NMCP_HARD_MODE === "1"
}

/**
 * Phase 4: Check if counsel needs to be refreshed based on TTL
 * Returns the age in ms if refresh needed, or null if still valid
 */
export function needsCounselRefresh(state: SessionState): number | null {
  if (state.contextChecks.length === 0) {
    return Infinity // No counsel yet - definitely needs refresh
  }

  const now = Date.now()
  let mostRecentAge: number | null = null

  for (const check of state.contextChecks) {
    const checkTime = check.timestamp.getTime()
    const age = now - checkTime
    if (mostRecentAge === null || age < mostRecentAge) {
      mostRecentAge = age
    }
  }

  if (mostRecentAge === null || mostRecentAge > COUNSEL_TTL_MS) {
    return mostRecentAge ?? Infinity
  }

  return null // Counsel is still valid
}

/**
 * Generate a context check description that incorporates goal profile
 * Phase 3: Use goal profile for relevance-gated context checks
 */
export function generateContextCheckDescription(
  toolName: string,
  filePath: string | undefined,
  goalProfile: GoalProfile | undefined
): string {
  const parts: string[] = [`About to use ${toolName}`]

  if (filePath) {
    parts.push(`on ${filePath}`)
  }

  if (goalProfile && goalProfile.focusAreas.length > 0) {
    parts.push(`for: ${goalProfile.focusAreas.slice(0, 3).join(", ")}`)
  }

  return parts.join(" ")
}

/**
 * Check if server is offline and enforcement should be skipped
 */
export function isServerOffline(status: ServerStatus): boolean {
  return status === "offline"
}

export function createCommunionViolation(projectPath: string): CovenantViolation {
  return {
    status: "blocked",
    violation: "COMMUNION_REQUIRED",
    message:
      "The Sacred Covenant demands communion before work begins. " +
      "You must first call get_briefing() to commune with the Daem0n " +
      "and receive context about this realm's memories, warnings, and rules.",
    projectPath,
    remedy: {
      tool: "get_briefing",
      args: { project_path: projectPath },
      description: "Begin communion with the Daem0n",
    },
  }
}

export function createCounselViolation(toolName: string, projectPath: string): CovenantViolation {
  return {
    status: "blocked",
    violation: "COUNSEL_REQUIRED",
    message:
      `The Sacred Covenant requires seeking counsel before using '${toolName}'. ` +
      `You must first call context_check() to understand existing memories ` +
      `and rules related to your intended action.`,
    projectPath,
    toolBlocked: toolName,
    remedy: {
      tool: "context_check",
      args: {
        description: `About to use ${toolName}`,
        project_path: projectPath,
      },
      description: `Seek counsel before ${toolName}`,
    },
  }
}

export function createCounselExpiredViolation(
  toolName: string,
  projectPath: string,
  ageMs: number
): CovenantViolation {
  const ageSeconds = Math.floor(ageMs / 1000)
  const limitSeconds = Math.floor(COUNSEL_TTL_MS / 1000)
  
  return {
    status: "blocked",
    violation: "COUNSEL_EXPIRED",
    message:
      `Your counsel has grown stale (${ageSeconds}s old, limit is ${limitSeconds}s). ` +
      `The context may have changed. Please seek fresh counsel before '${toolName}'.`,
    projectPath,
    toolBlocked: toolName,
    remedy: {
      tool: "context_check",
      args: {
        description: `Refreshing counsel before ${toolName}`,
        project_path: projectPath,
      },
      description: "Seek fresh counsel",
    },
  }
}

export function extractMcpToolName(tool: string): string | null {
  const match = tool.match(/^mcp__daem0nmcp__(.+)$/)
  return match ? match[1] : null
}

export function isCovenantExempt(toolName: string): boolean {
  return COVENANT_EXEMPT_TOOLS.has(toolName)
}

export function requiresCommunion(toolName: string): boolean {
  return COMMUNION_REQUIRED_TOOLS.has(toolName)
}

export function requiresCounsel(toolName: string): boolean {
  return COUNSEL_REQUIRED_TOOLS.has(toolName)
}

export function evaluateCommunionGate(
  state: SessionState,
  projectPath: string
): CovenantViolation | null {
  if (!state.briefed) {
    return createCommunionViolation(projectPath)
  }
  return null
}

export function evaluateCounselGate(
  toolName: string,
  state: SessionState,
  projectPath: string
): CovenantViolation | null {
  const communionViolation = evaluateCommunionGate(state, projectPath)
  if (communionViolation) {
    return communionViolation
  }

  if (state.contextChecks.length === 0) {
    return createCounselViolation(toolName, projectPath)
  }

  const now = Date.now()
  let mostRecentAge: number | null = null

  for (const check of state.contextChecks) {
    const checkTime = check.timestamp.getTime()
    const age = now - checkTime
    if (mostRecentAge === null || age < mostRecentAge) {
      mostRecentAge = age
    }
  }

  if (mostRecentAge === null) {
    return createCounselViolation(toolName, projectPath)
  }

  if (mostRecentAge > COUNSEL_TTL_MS) {
    return createCounselExpiredViolation(toolName, projectPath, mostRecentAge)
  }

  return null
}

export function evaluateToolGate(
  tool: string,
  state: SessionState,
  projectPath: string
): { allow: true } | { allow: false; violation: CovenantViolation } {
  // Skip all enforcement if server is offline (defense in depth)
  if (isServerOffline(state.serverStatus)) {
    return { allow: true }
  }

  const mcpToolName = extractMcpToolName(tool)
  
  if (!mcpToolName) {
    return { allow: true }
  }

  if (isCovenantExempt(mcpToolName)) {
    return { allow: true }
  }

  if (requiresCounsel(mcpToolName)) {
    const violation = evaluateCounselGate(mcpToolName, state, projectPath)
    if (violation) {
      return { allow: false, violation }
    }
    return { allow: true }
  }

  if (requiresCommunion(mcpToolName)) {
    const violation = evaluateCommunionGate(state, projectPath)
    if (violation) {
      return { allow: false, violation }
    }
    return { allow: true }
  }

  return { allow: true }
}

export function markCommunionComplete(state: SessionState): void {
  state.briefed = true
  state.briefedAt = new Date()
}

export function markCounselComplete(state: SessionState, topic: string): void {
  state.contextChecks.push({
    topic,
    timestamp: new Date(),
  })

  if (state.contextChecks.length > 20) {
    state.contextChecks = state.contextChecks.slice(-20)
  }
}
