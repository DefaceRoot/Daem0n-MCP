/**
 * Daem0n-MCP OpenCode Plugin
 * 
 * Provides automatic memory capture and protocol enforcement for AI agents.
 * 
 * Features:
 * - Session start: AUTO-CALLS get_briefing() and injects digest (Phase 2)
 * - Root prompt capture: Extracts goal profile for relevance routing (Phase 3)
 * - Pre-edit: Injects relevant memories before file edits
 * - Post-edit: Suggests remembering significant changes
 * - Session idle: Auto-extracts decisions from conversations
 * - Covenant enforcement: Blocks mutating tools until briefed
 * - Offline-safe: Degrades gracefully when MCP server unavailable
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin"
import type { SessionState, ServerStatus, GoalProfile, PreEditDebounceState } from "./types"
import { FILE_EDIT_TOOLS, PRE_EDIT_DEBOUNCE_MS } from "./types"
import {
  evaluateToolGate,
  extractMcpToolName,
  markCommunionComplete,
  markCounselComplete,
  isMutatingHostTool,
  isHardModeEnabled,
  needsCounselRefresh,
  generateContextCheckDescription,
} from "./covenant"
import { Daem0nMcpClient } from "./utils/mcp-client"
import { handleSessionCreated, handleSessionIdle, handleSessionCompacting } from "./hooks/session"
import { handlePreEdit, shouldDebouncePreEdit, updateDebounceState } from "./hooks/pre-edit"
import { handlePostEdit, isSignificantChange } from "./hooks/post-edit"
import { handleBashOutcome, formatOutcomeResult, shouldTryRecordOutcome } from "./hooks/outcome"
import type { PreEditInjectionResult } from "./hooks/pre-edit"
import { createGoalProfile, summarizeGoalProfile, isEmptyProfile } from "./utils/goal-profile"

/** Session state storage - keyed by session ID */
const sessionStates = new Map<string, SessionState>()

/** Global plugin state */
let globalServerStatus: ServerStatus = "unknown"
let offlineLogged = false

function getOrCreateSessionState(sessionId: string): SessionState {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      serverStatus: globalServerStatus,
      briefed: false,
      briefedAt: undefined,
      briefingDigest: undefined,
      pendingOutcomeIds: new Set(),
      contextChecks: [],
      modifiedFiles: new Map(),
      offlineLogged: false,
      rootUserPrompt: undefined,
      goalProfile: undefined,
      lastUserPromptAt: undefined,
      digestInjected: false,
      dedupe: new Set(),
      // Phase 5: Pre-edit debounce state
      preEditDebounce: {
        lastInjection: new Map(),
        lastMemoryHashes: new Map(),
      },
      // Phase 6: Outcome reminder flag
      outcomeReminderShown: false,
    })
  }
  return sessionStates.get(sessionId)!
}

function getRecentToolCalls(messages: unknown[]): string[] {
  const toolCalls: string[] = []
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (typeof msg === "object" && msg !== null) {
        const obj = msg as Record<string, unknown>
        const parts = obj.parts as unknown[]
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part === "object" && part !== null) {
              const p = part as Record<string, unknown>
              if (p.type === "tool-invocation" && typeof p.toolName === "string") {
                toolCalls.push(p.toolName)
              }
            }
          }
        }
      }
    }
  }
  return toolCalls
}

/**
 * Plugin factory function - OpenCode calls this with context
 * Uses official Plugin type from @opencode-ai/plugin
 */
export const Daem0nMCPPlugin: Plugin = async ({ client, project, directory, worktree, serverUrl, $ }) => {
  const projectPath = directory || process.cwd()
  const mcp = new Daem0nMcpClient({ projectPath })

  console.log("[Daem0nMCP] Plugin initialized for:", projectPath)

  // Perform initial server health check
  try {
    const healthResult = await mcp.healthWithTimeout(2000)
    if (healthResult.success) {
      globalServerStatus = "online"
      console.log("[Daem0nMCP] Server online:", healthResult.data?.version || "unknown version")
    } else {
      globalServerStatus = "offline"
      console.log("[Daem0nMCP] Server offline:", healthResult.error)
      if (!offlineLogged) {
        offlineLogged = true
        console.warn("[Daem0nMCP] Daem0n server unreachable; memory automation disabled for this session.")
      }
    }
  } catch (err) {
    globalServerStatus = "offline"
    console.log("[Daem0nMCP] Server health check failed:", err)
    if (!offlineLogged) {
      offlineLogged = true
      console.warn("[Daem0nMCP] Daem0n server unreachable; memory automation disabled for this session.")
    }
  }

  const hooks: Hooks = {
    /**
     * Generic event handler for session lifecycle events
     */
    event: async ({ event }) => {
      const sessionId = (event as Record<string, unknown>).sessionID as string || "default"
      const state = getOrCreateSessionState(sessionId)

      // Update server status from global
      state.serverStatus = globalServerStatus

      switch (event.type) {
        case "session.created": {
          console.log("[Daem0nMCP] session.created - Session:", sessionId)
          
          // Check server status again on session create
          if (globalServerStatus === "unknown") {
            try {
              const healthResult = await mcp.healthWithTimeout(2000)
              if (healthResult.success) {
                globalServerStatus = "online"
                state.serverStatus = "online"
              } else {
                globalServerStatus = "offline"
                state.serverStatus = "offline"
              }
            } catch {
              globalServerStatus = "offline"
              state.serverStatus = "offline"
            }
          }

          // If offline, just log once and skip memory operations
          if (state.serverStatus === "offline") {
            if (!state.offlineLogged) {
              state.offlineLogged = true
              console.warn("[Daem0nMCP] Server offline - memory automation disabled for this session")
            }
            return
          }

          // Phase 2: Auto-briefing on session.created
          const output: { message?: string; context?: string | string[] } = {}
          const result = await handleSessionCreated(mcp, state, output)

          if (result.success && result.digest) {
            // Digest is already in output.message from handleSessionCreated
            // Mark as injected since the session hook output will include it
            state.digestInjected = true
            console.log(`[Daem0nMCP] Auto-briefing digest ready (${result.digest.formatted.length} chars)`)
          }
          break
        }

        case "session.idle": {
          // Skip if offline
          if (state.serverStatus === "offline") return

          console.log("[Daem0nMCP] session.idle - checking for decision extraction")
          
          // Get recent messages from event if available
          const eventData = event as Record<string, unknown>
          const lastContent = eventData.lastAssistantMessage as string || ""
          const recentMessages = eventData.messages as unknown[] || []
          const recentToolCalls = getRecentToolCalls(recentMessages)

          await handleSessionIdle(mcp, state, lastContent, recentToolCalls, projectPath)
          break
        }

        case "session.error": {
          console.log("[Daem0nMCP] session.error:", (event as Record<string, unknown>).error)
          break
        }
      }
    },

    /**
     * Phase 3: Chat message hook - capture root user prompt for goal profile
     * 
     * This hook captures the first user message of each session to:
     * - Store as rootUserPrompt
     * - Compute goalProfile for relevance-gated memory retrieval
     */
    "chat.message": async (input, output) => {
      const { message, sessionID } = input as { message: { role: string; content: string }; sessionID: string }
      const state = getOrCreateSessionState(sessionID)

      // Only process user messages
      if (message?.role !== "user") return

      const userText = typeof message.content === "string" 
        ? message.content 
        : (message.content as { text?: string })?.text || ""

      if (!userText || userText.trim().length === 0) return

      // Update last user prompt timestamp
      state.lastUserPromptAt = new Date()

      // Phase 3: Capture root user prompt (first user message of session)
      if (!state.rootUserPrompt) {
        state.rootUserPrompt = userText
        state.goalProfile = createGoalProfile(userText)
        
        if (!isEmptyProfile(state.goalProfile)) {
          const summary = summarizeGoalProfile(state.goalProfile)
          console.log(`[Daem0nMCP] Root prompt captured. Goal profile: ${summary}`)
          console.log(`[Daem0nMCP] Keywords: ${Array.from(state.goalProfile.keywords).slice(0, 10).join(", ")}`)
          console.log(`[Daem0nMCP] Domains: ${Array.from(state.goalProfile.domains).join(", ")}`)
          console.log(`[Daem0nMCP] Focus areas: ${state.goalProfile.focusAreas.join(", ")}`)
        } else {
          console.log("[Daem0nMCP] Root prompt captured but no significant keywords/domains detected")
        }
      } else {
        // Update goal profile with subsequent messages (optional - merge profiles)
        const newProfile = createGoalProfile(userText)
        if (!isEmptyProfile(newProfile) && state.goalProfile) {
          // Merge new domains/keywords into existing profile
          newProfile.domains.forEach(d => state.goalProfile!.domains.add(d))
          newProfile.keywords.forEach(k => state.goalProfile!.keywords.add(k))
          // Update focus areas if new domains discovered
          if (newProfile.domains.size > 0) {
            const allFocusAreas = [...new Set([
              ...state.goalProfile.focusAreas,
              ...newProfile.focusAreas
            ])]
            state.goalProfile.focusAreas = allFocusAreas.slice(0, 5)
          }
        }
      }
    },

    /**
     * Pre-tool execution hook
     * Phase 4: Autonomous covenant enforcement + pre-edit context injection
     * 
     * Behavior:
     * - Server offline → allow everything
     * - MCP tools (mcp__daem0nmcp__*) → allow (covenant applies to host tools)
     * - Mutating host tools (edit/write/bash) → auto-enforce covenant
     *   - Auto-call get_briefing if not briefed (communion)
     *   - Auto-call context_check if TTL expired (counsel)
     *   - Hard mode (DAEM0NMCP_HARD_MODE=true) throws instead of auto-fixing
     */
    "tool.execute.before": async (input, output) => {
      const { tool: toolName, sessionID } = input
      const state = getOrCreateSessionState(sessionID)
      const args = output.args as Record<string, unknown> || {}

      console.log("[Daem0nMCP] tool.execute.before:", toolName)

      // Skip all enforcement if server is offline
      if (state.serverStatus === "offline") {
        return
      }

      // MCP tools: allow always (never block daem0nmcp tools)
      const mcpToolName = extractMcpToolName(toolName)
      if (mcpToolName) {
        // For MCP tools, still apply covenant gate for daem0nmcp tools
        const gateResult = evaluateToolGate(toolName, state, projectPath)
        if (!gateResult.allow && isHardModeEnabled()) {
          const violation = gateResult.violation
          console.log("[Daem0nMCP] Hard mode - blocking MCP tool:", violation.violation)
          throw new Error(
            `${violation.message}\n\nRemedy: Call ${violation.remedy.tool}(${JSON.stringify(violation.remedy.args)})`
          )
        }
        return
      }

      // Check if this is a mutating host tool that requires covenant enforcement
      if (isMutatingHostTool(toolName)) {
        const filePath = (args.filePath || args.file_path || args.path) as string | undefined
        const hardMode = isHardModeEnabled()

        // Phase 4: Auto-communion - ensure briefed before mutating tools
        if (!state.briefed) {
          if (hardMode) {
            console.log("[Daem0nMCP] Hard mode - blocking tool until briefed")
            throw new Error(
              `[Daem0nMCP] Communion required before using '${toolName}'.\n` +
              `Call get_briefing() first to understand the project's memories and warnings.`
            )
          }

          // Auto-fix: Call get_briefing automatically
          console.log("[Daem0nMCP] Auto-communion: calling get_briefing() before", toolName)
          try {
            const briefingResult = await mcp.getBriefingWithTimeout(
              state.goalProfile?.focusAreas,
              5000
            )
            if (briefingResult.success) {
              markCommunionComplete(state)
              console.log("[Daem0nMCP] Auto-communion complete - briefed = true")
            } else {
              console.warn("[Daem0nMCP] Auto-communion failed:", briefingResult.error)
              // Continue anyway - don't block the user
            }
          } catch (err) {
            console.warn("[Daem0nMCP] Auto-communion error:", err)
            // Continue anyway - don't block the user
          }
        }

        // Phase 4: Auto-counsel - ensure context_check within TTL before mutating tools
        const counselAge = needsCounselRefresh(state)
        if (counselAge !== null) {
          if (hardMode) {
            const ageStr = counselAge === Infinity ? "never" : `${Math.floor(counselAge / 1000)}s ago`
            console.log("[Daem0nMCP] Hard mode - blocking tool until counsel refreshed (last:", ageStr, ")")
            throw new Error(
              `[Daem0nMCP] Counsel required before using '${toolName}'.\n` +
              `Your last context_check was ${ageStr}. Call context_check() to get fresh guidance.`
            )
          }

          // Auto-fix: Call context_check automatically
          const description = generateContextCheckDescription(toolName, filePath, state.goalProfile)
          console.log("[Daem0nMCP] Auto-counsel: calling context_check() for:", description)
          try {
            const checkResult = await mcp.contextCheckWithTimeout(description, 5000)
            if (checkResult.success) {
              markCounselComplete(state, description)
              console.log("[Daem0nMCP] Auto-counsel complete - context_check recorded")
              
              // If context_check returned warnings, log them
              if (checkResult.data?.rules && checkResult.data.rules.length > 0) {
                console.log("[Daem0nMCP] Rules matched:", checkResult.data.rules.length)
              }
            } else {
              console.warn("[Daem0nMCP] Auto-counsel failed:", checkResult.error)
              // Continue anyway - don't block the user
            }
          } catch (err) {
            console.warn("[Daem0nMCP] Auto-counsel error:", err)
            // Continue anyway - don't block the user
          }
        }
      }

      // Phase 5: Handle pre-edit injection for file edit tools with debounce
      if (FILE_EDIT_TOOLS.has(toolName)) {
        const filePath = (args.filePath || args.file_path) as string

        if (filePath && state.briefed) {
          // Get pre-edit context with bounded retrieval and priority ordering
          const preEditResult = await handlePreEdit(mcp, filePath, state.goalProfile, state)
          
          if (preEditResult && preEditResult.context) {
            // Check debounce (2 min per file, unless content changed)
            const shouldDebounce = shouldDebouncePreEdit(state, filePath, preEditResult.hash)
            
            if (!shouldDebounce) {
              // Inject context as metadata (OpenCode will include in prompt)
              output.args = { ...args, _daem0n_context: preEditResult.context }
              
              // Update debounce state
              updateDebounceState(state, filePath, preEditResult.hash)
              
              console.log(`[Daem0nMCP] Pre-edit context injected: ${preEditResult.itemCount} items for ${filePath}`)
            } else {
              console.log(`[Daem0nMCP] Pre-edit debounced for ${filePath}`)
            }
          }
        }
      }
    },

    /**
     * Post-tool execution hook
     * Tracks communion/counsel completion and handles post-edit actions
     */
    "tool.execute.after": async (input, output) => {
      const { tool: toolName, sessionID } = input
      const state = getOrCreateSessionState(sessionID)

      console.log("[Daem0nMCP] tool.execute.after:", toolName)

      // Skip if offline
      if (state.serverStatus === "offline") {
        return
      }

      const mcpToolName = extractMcpToolName(toolName)

      // Track communion completion
      if (mcpToolName === "get_briefing") {
        markCommunionComplete(state)
        console.log("[Daem0nMCP] Communion complete - briefed = true")
      } 
      // Track counsel completion
      else if (mcpToolName === "context_check") {
        const metadata = output.metadata as Record<string, unknown> || {}
        const topic = (metadata.description as string) || "unknown"
        markCounselComplete(state, topic)
        console.log("[Daem0nMCP] Counsel recorded for topic:", topic)
      }

      // Phase 6: Handle post-edit auto-remember for file edit tools
      if (FILE_EDIT_TOOLS.has(toolName)) {
        const metadata = output.metadata as Record<string, unknown> || {}
        const filePath = (metadata.filePath || metadata.file_path) as string
        const oldString = (metadata.oldString as string) || ""
        const newString = (metadata.newString as string) || ""

        if (filePath) {
          // Auto-remember significant changes (Phase 6)
          const autoRememberResult = await handlePostEdit(
            mcp,
            filePath,
            oldString,
            newString,
            state,
            state.goalProfile
          )
          
          if (autoRememberResult.created && autoRememberResult.memoryId) {
            console.log(`[Daem0nMCP] Auto-remembered edit to ${filePath} (id: ${autoRememberResult.memoryId})`)
          } else if (autoRememberResult.deduplicated) {
            console.log(`[Daem0nMCP] Edit to ${filePath} deduplicated (already recorded)`)
          } else if (autoRememberResult.error) {
            console.warn(`[Daem0nMCP] Auto-remember failed for ${filePath}:`, autoRememberResult.error)
          }
        }
      }

      // Phase 8: Handle bash output for evidence-based outcome recording
      if (toolName === "bash" || toolName === "Bash") {
        const metadata = output.metadata as Record<string, unknown> || {}
        const bashCommand = (metadata.command as string) || ""
        const bashOutput = (metadata.output as string) || (metadata.stdout as string) || ""
        const exitCode = metadata.exitCode as number | undefined

        // Check if we should try to record outcomes
        if (shouldTryRecordOutcome(bashCommand, bashOutput, state)) {
          console.log(`[Daem0nMCP] Checking bash output for evidence (${state.pendingOutcomeIds.size} pending)`)
          
          const outcomeResult = await handleBashOutcome(
            mcp,
            bashCommand,
            bashOutput,
            exitCode,
            state
          )
          
          if (outcomeResult.recorded) {
            console.log(`[Daem0nMCP] ${outcomeResult.summary}`)
            
            // Inject outcome recording message as context
            const outcomeMessage = formatOutcomeResult(outcomeResult)
            if (outcomeMessage) {
              // Store for potential injection (though tool.execute.after can't inject)
              console.log(outcomeMessage)
            }
          } else if (outcomeResult.evidence?.hasEvidence) {
            console.log(`[Daem0nMCP] Evidence detected but not recorded: ${outcomeResult.summary}`)
          }
        }
      }
    },

    /**
     * Session compaction hook
     * 
     * Phase 9: Compaction survival implementation
     * 
     * Preserves critical state during context window compaction:
     * - Server online/offline status
     * - Briefed true/false (communion complete)
     * - Number of counsel checks
     * - Number of pending outcomes
     * - Modified files (max 5)
     * - Goal profile summary for relevance routing
     * 
     * This ensures the plugin continues enforcing and remembering
     * correctly after the context is compacted.
     */
    "experimental.session.compacting": async (input, output) => {
      const { sessionID } = input
      const state = getOrCreateSessionState(sessionID)

      console.log("[Daem0nMCP] Session compacting - preserving covenant state")

      // handleSessionCompacting now handles offline case internally
      const context = handleSessionCompacting(state)
      if (context) {
        output.context = context
        console.log(`[Daem0nMCP] Compaction context: ${context.length} lines preserved`)
      }
    },
  }

  return hooks
}

export default Daem0nMCPPlugin
