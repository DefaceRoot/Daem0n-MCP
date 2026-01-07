/**
 * Daem0n-MCP OpenCode Plugin
 * 
 * Provides automatic memory capture and protocol enforcement for AI agents.
 * 
 * Features:
 * - Session start: Reminds to call get_briefing()
 * - Pre-edit: Injects relevant memories before file edits
 * - Post-edit: Suggests remembering significant changes
 * - Session idle: Auto-extracts decisions from conversations
 * - Covenant enforcement: Blocks mutating tools until briefed
 */

import type { SessionState } from "./types"
import { FILE_EDIT_TOOLS } from "./types"
import {
  evaluateToolGate,
  extractMcpToolName,
  markCommunionComplete,
  markCounselComplete,
} from "./covenant"
import { Daem0nMcpClient } from "./utils/mcp-client"
import { handleSessionCreated, handleSessionIdle, handleSessionCompacting } from "./hooks/session"
import { handlePreEdit } from "./hooks/pre-edit"
import { handlePostEdit, isSignificantChange } from "./hooks/post-edit"

const sessionStates = new Map<string, SessionState>()

function getOrCreateSessionState(sessionId: string): SessionState {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      briefed: false,
      contextChecks: [],
      modifiedFiles: new Map(),
    })
  }
  return sessionStates.get(sessionId)!
}

function getRecentToolCalls(input: Record<string, unknown>): string[] {
  const toolCalls: string[] = []
  const content = input.recentContent as unknown[]
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>
        if (obj.type === "tool_use" && typeof obj.name === "string") {
          toolCalls.push(obj.name)
        }
      }
    }
  }
  return toolCalls
}

// Plugin factory function - OpenCode will call this with context
export const Daem0nMCPPlugin = async (ctx: { directory: string; worktree?: string }) => {
  const projectPath = ctx.directory || process.cwd()
  const mcp = new Daem0nMcpClient({ projectPath })

  console.log("[Daem0nMCP] Plugin initialized for:", projectPath)

  return {
    "session.created": async (input: Record<string, unknown>, output: Record<string, unknown>) => {
      const sessionId = (input.session as Record<string, unknown>)?.id as string || "default"
      console.log("[Daem0nMCP] session.created - Session:", sessionId)

      const state = getOrCreateSessionState(sessionId)
      await handleSessionCreated(mcp, state, output as { message?: string })
    },

    "session.idle": async (input: Record<string, unknown>, output: Record<string, unknown>) => {
      const sessionId = (input.session as Record<string, unknown>)?.id as string || "default"
      const state = getOrCreateSessionState(sessionId)

      console.log("[Daem0nMCP] session.idle - checking for decision extraction")

      const recentContent = (input.lastAssistantMessage as string) || ""
      const recentToolCalls = getRecentToolCalls(input)

      const message = await handleSessionIdle(mcp, state, recentContent, recentToolCalls, projectPath)
      if (message) {
        output.message = message
      }
    },

    "session.error": async (input: Record<string, unknown>, _output: Record<string, unknown>) => {
      console.log("[Daem0nMCP] session.error:", input.error)
    },

    "tool.execute.before": async (input: Record<string, unknown>, output: Record<string, unknown>) => {
      const toolName = typeof input.tool === "string" ? input.tool : (input.tool as Record<string, unknown>)?.name as string
      const sessionId = (input.session as Record<string, unknown>)?.id as string || "default"
      const state = getOrCreateSessionState(sessionId)

      console.log("[Daem0nMCP] tool.execute.before:", toolName)

      const gateResult = evaluateToolGate(toolName, state, projectPath)

      if (!gateResult.allow) {
        const violation = gateResult.violation
        console.log("[Daem0nMCP] Blocking tool - violation:", violation.violation)
        throw new Error(
          `${violation.message}\n\nRemedy: Call ${violation.remedy.tool}(${JSON.stringify(violation.remedy.args)})`
        )
      }

      if (FILE_EDIT_TOOLS.has(toolName)) {
        const args = input.args as Record<string, unknown> || input.input as Record<string, unknown> || {}
        const filePath = (args.filePath || args.file_path) as string

        if (filePath && state.briefed) {
          const context = await handlePreEdit(mcp, filePath)
          if (context) {
            output.context = context
          }
        }
      }
    },

    "tool.execute.after": async (input: Record<string, unknown>, output: Record<string, unknown>) => {
      const toolName = typeof input.tool === "string" ? input.tool : (input.tool as Record<string, unknown>)?.name as string
      const sessionId = (input.session as Record<string, unknown>)?.id as string || "default"
      const state = getOrCreateSessionState(sessionId)

      console.log("[Daem0nMCP] tool.execute.after:", toolName)

      const mcpToolName = extractMcpToolName(toolName)

      if (mcpToolName === "get_briefing") {
        markCommunionComplete(state)
        console.log("[Daem0nMCP] Communion complete - briefed = true")
      } else if (mcpToolName === "context_check") {
        const args = input.args as Record<string, unknown> || input.input as Record<string, unknown> || {}
        const topic = (args.description as string) || "unknown"
        markCounselComplete(state, topic)
        console.log("[Daem0nMCP] Counsel recorded for topic:", topic)
      }

      if (FILE_EDIT_TOOLS.has(toolName)) {
        const args = input.args as Record<string, unknown> || input.input as Record<string, unknown> || {}
        const filePath = (args.filePath || args.file_path) as string
        const oldString = (args.oldString as string) || ""
        const newString = (args.newString as string) || ""

        if (filePath && isSignificantChange(filePath, `${oldString} -> ${newString}`)) {
          const message = await handlePostEdit(filePath, oldString, newString, state)
          if (message) {
            output.message = message
          }
        }
      }
    },

    "file.edited": async (input: Record<string, unknown>, _output: Record<string, unknown>) => {
      const filePath = (input.file as Record<string, unknown>)?.path as string || input.path as string
      console.log("[Daem0nMCP] file.edited:", filePath)
    },

    "message.updated": async (_input: Record<string, unknown>, _output: Record<string, unknown>) => {
    },

    "experimental.session.compacting": async (input: Record<string, unknown>, output: Record<string, unknown>) => {
      const sessionId = (input.session as Record<string, unknown>)?.id as string || "default"
      const state = getOrCreateSessionState(sessionId)

      const context = handleSessionCompacting(state)
      if (context) {
        output.context = context
      }
    },
  }
}

export default Daem0nMCPPlugin
