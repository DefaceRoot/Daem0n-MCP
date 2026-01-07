import type { 
  MCPToolResult, 
  BriefingResponse, 
  ContextCheckResult, 
  RecallResult,
  Memory 
} from "../types"

const DEFAULT_MCP_URL = "http://localhost:9876/mcp"
const DEFAULT_TIMEOUT_MS = 30000

interface MCPRequest {
  jsonrpc: "2.0"
  method: string
  params: Record<string, unknown>
  id: number
}

interface MCPResponse {
  jsonrpc: "2.0"
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
  id: number
}

export class Daem0nMcpClient {
  private baseUrl: string
  private timeout: number
  private requestId: number = 0
  private projectPath: string

  constructor(options: {
    baseUrl?: string
    timeout?: number
    projectPath: string
  }) {
    this.baseUrl = options.baseUrl || process.env.DAEM0NMCP_URL || DEFAULT_MCP_URL
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS
    this.projectPath = options.projectPath
  }

  private async callRpc<T>(method: string, params: Record<string, unknown>): Promise<MCPToolResult<T>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: `tools/${method}`,
      params: { ...params, project_path: this.projectPath },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = (await response.json()) as MCPResponse

      if (data.error) {
        return {
          success: false,
          error: `MCP Error ${data.error.code}: ${data.error.message}`,
        }
      }

      return {
        success: true,
        data: data.result as T,
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          return { success: false, error: `Timeout after ${this.timeout}ms` }
        }
        if (err.message.includes("ECONNREFUSED")) {
          return {
            success: false,
            error: `Cannot connect to MCP server at ${this.baseUrl}. Is it running? Start with: start_daem0nmcp_server.bat`,
          }
        }
        return { success: false, error: err.message }
      }
      return { success: false, error: "Unknown error" }
    }
  }

  async health(): Promise<MCPToolResult<{ status: string; version: string }>> {
    return this.callRpc("health", {})
  }

  async getBriefing(focusAreas?: string[]): Promise<MCPToolResult<BriefingResponse>> {
    return this.callRpc("get_briefing", { focus_areas: focusAreas })
  }

  async contextCheck(description: string): Promise<MCPToolResult<ContextCheckResult>> {
    return this.callRpc("context_check", { description })
  }

  async recall(topic: string, condensed?: boolean): Promise<MCPToolResult<RecallResult>> {
    return this.callRpc("recall", { topic, condensed })
  }

  async recallForFile(filePath: string): Promise<MCPToolResult<RecallResult>> {
    return this.callRpc("recall_for_file", { file_path: filePath })
  }

  async checkContextTriggers(filePath: string): Promise<MCPToolResult<{
    triggers: Array<{ pattern: string; recall_topic: string }>
    memories: Record<string, RecallResult>
    total_triggers: number
  }>> {
    return this.callRpc("check_context_triggers", { file_path: filePath })
  }

  async remember(params: {
    category: "decision" | "pattern" | "warning" | "learning"
    content: string
    rationale?: string
    tags?: string[]
    filePath?: string
  }): Promise<MCPToolResult<Memory>> {
    return this.callRpc("remember", {
      category: params.category,
      content: params.content,
      rationale: params.rationale,
      tags: params.tags,
      file_path: params.filePath,
    })
  }

  async recordOutcome(params: {
    memoryId: number
    outcome: string
    worked: boolean
  }): Promise<MCPToolResult<Memory>> {
    return this.callRpc("record_outcome", {
      memory_id: params.memoryId,
      outcome: params.outcome,
      worked: params.worked,
    })
  }

  async callTool<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult<T>> {
    return this.callRpc(toolName, args)
  }
}
