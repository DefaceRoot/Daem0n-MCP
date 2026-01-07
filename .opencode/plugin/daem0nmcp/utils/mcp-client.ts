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

  /**
   * Health check with custom timeout (for fast offline detection)
   * @param timeoutMs Timeout in milliseconds (default: 2000ms)
   */
  async healthWithTimeout(timeoutMs: number = 2000): Promise<MCPToolResult<{ status: string; version: string }>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/health",
      params: { project_path: this.projectPath },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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
        data: data.result as { status: string; version: string },
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          return { success: false, error: `Timeout after ${timeoutMs}ms` }
        }
        if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
          return {
            success: false,
            error: `Cannot connect to MCP server at ${this.baseUrl}`,
          }
        }
        return { success: false, error: err.message }
      }
      return { success: false, error: "Unknown error" }
    }
  }

  async getBriefing(focusAreas?: string[]): Promise<MCPToolResult<BriefingResponse>> {
    return this.callRpc("get_briefing", { focus_areas: focusAreas })
  }

  /**
   * Get briefing with custom timeout (for session start automation)
   * @param focusAreas Optional focus areas to include pre-fetched context
   * @param timeoutMs Timeout in milliseconds (default: 5000ms)
   */
  async getBriefingWithTimeout(
    focusAreas?: string[],
    timeoutMs: number = 5000
  ): Promise<MCPToolResult<BriefingResponse>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/get_briefing",
      params: { 
        project_path: this.projectPath,
        focus_areas: focusAreas 
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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
        data: data.result as BriefingResponse,
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          return { success: false, error: `Briefing timeout after ${timeoutMs}ms` }
        }
        if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
          return {
            success: false,
            error: `Cannot connect to MCP server at ${this.baseUrl}`,
          }
        }
        return { success: false, error: err.message }
      }
      return { success: false, error: "Unknown error" }
    }
  }

  async contextCheck(description: string): Promise<MCPToolResult<ContextCheckResult>> {
    return this.callRpc("context_check", { description })
  }

  /**
   * Context check with custom timeout (for autonomous counsel)
   * Phase 4: Used for auto-counsel before mutating tools
   * @param description Description of the action being performed
   * @param timeoutMs Timeout in milliseconds (default: 5000ms)
   */
  async contextCheckWithTimeout(
    description: string,
    timeoutMs: number = 5000
  ): Promise<MCPToolResult<ContextCheckResult>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/context_check",
      params: { 
        project_path: this.projectPath,
        description 
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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
        data: data.result as ContextCheckResult,
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          return { success: false, error: `Context check timeout after ${timeoutMs}ms` }
        }
        if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
          return {
            success: false,
            error: `Cannot connect to MCP server at ${this.baseUrl}`,
          }
        }
        return { success: false, error: err.message }
      }
      return { success: false, error: "Unknown error" }
    }
  }

  async recall(topic: string, condensed?: boolean): Promise<MCPToolResult<RecallResult>> {
    return this.callRpc("recall", { topic, condensed })
  }

  async recallForFile(filePath: string): Promise<MCPToolResult<RecallResult>> {
    return this.callRpc("recall_for_file", { file_path: filePath })
  }

  /**
   * Phase 5: Recall for file with limit (for bounded pre-edit injection)
   * @param filePath Path to the file
   * @param limit Maximum memories to return
   * @param timeoutMs Timeout in milliseconds (default: 3000ms)
   */
  async recallForFileWithLimit(
    filePath: string,
    limit: number = 5,
    timeoutMs: number = 3000
  ): Promise<MCPToolResult<RecallResult>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/recall_for_file",
      params: { 
        project_path: this.projectPath,
        file_path: filePath,
        limit 
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as MCPResponse

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, data: data.result as RecallResult }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: `Timeout after ${timeoutMs}ms` }
      }
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }

  /**
   * Phase 5: Check context triggers with timeout
   * @param filePath Path to the file
   * @param timeoutMs Timeout in milliseconds (default: 3000ms)
   */
  async checkContextTriggersWithTimeout(
    filePath: string,
    timeoutMs: number = 3000
  ): Promise<MCPToolResult<{
    triggers: Array<{ pattern: string; recall_topic: string }>
    memories: Record<string, RecallResult>
    total_triggers: number
  }>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/check_context_triggers",
      params: { 
        project_path: this.projectPath,
        file_path: filePath 
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as MCPResponse

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, data: data.result as {
        triggers: Array<{ pattern: string; recall_topic: string }>
        memories: Record<string, RecallResult>
        total_triggers: number
      }}
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: `Timeout after ${timeoutMs}ms` }
      }
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
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

  /**
   * Phase 6: Remember with timeout (for auto-remember)
   * @param params Memory parameters
   * @param timeoutMs Timeout in milliseconds (default: 5000ms)
   */
  async rememberWithTimeout(
    params: {
      category: "decision" | "pattern" | "warning" | "learning"
      content: string
      rationale?: string
      tags?: string[]
      filePath?: string
    },
    timeoutMs: number = 5000
  ): Promise<MCPToolResult<Memory>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/remember",
      params: { 
        project_path: this.projectPath,
        category: params.category,
        content: params.content,
        rationale: params.rationale,
        tags: params.tags,
        file_path: params.filePath,
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as MCPResponse

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, data: data.result as Memory }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: `Remember timeout after ${timeoutMs}ms` }
      }
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }

  /**
   * Phase 5: Condensed recall with timeout (for domain-based fallback)
   * @param topic Topic to recall
   * @param timeoutMs Timeout in milliseconds (default: 3000ms)
   */
  async recallCondensedWithTimeout(
    topic: string,
    timeoutMs: number = 3000
  ): Promise<MCPToolResult<RecallResult>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/recall",
      params: { 
        project_path: this.projectPath,
        topic,
        condensed: true 
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as MCPResponse

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, data: data.result as RecallResult }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: `Recall timeout after ${timeoutMs}ms` }
      }
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
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

  /**
   * Phase 8: Record outcome with timeout (for evidence-based auto-recording)
   * @param params Outcome parameters
   * @param timeoutMs Timeout in milliseconds (default: 5000ms)
   */
  async recordOutcomeWithTimeout(
    params: {
      memoryId: number
      outcome: string
      worked: boolean
    },
    timeoutMs: number = 5000
  ): Promise<MCPToolResult<Memory>> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/record_outcome",
      params: { 
        project_path: this.projectPath,
        memory_id: params.memoryId,
        outcome: params.outcome,
        worked: params.worked,
      },
      id: ++this.requestId,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as MCPResponse

      if (data.error) {
        return { success: false, error: data.error.message }
      }

      return { success: true, data: data.result as Memory }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: `Record outcome timeout after ${timeoutMs}ms` }
      }
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
    }
  }

  /**
   * Phase 8: Batch record outcomes for multiple memories
   * Used when evidence is detected to record outcomes for all pending memories
   */
  async recordOutcomesBatch(
    memoryIds: number[],
    outcome: string,
    worked: boolean,
    timeoutPerItem: number = 3000
  ): Promise<{ succeeded: number[]; failed: number[] }> {
    const succeeded: number[] = []
    const failed: number[] = []

    for (const memoryId of memoryIds) {
      const result = await this.recordOutcomeWithTimeout(
        { memoryId, outcome, worked },
        timeoutPerItem
      )
      
      if (result.success) {
        succeeded.push(memoryId)
      } else {
        failed.push(memoryId)
      }
    }

    return { succeeded, failed }
  }

  async callTool<T = unknown>(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult<T>> {
    return this.callRpc(toolName, args)
  }
}
