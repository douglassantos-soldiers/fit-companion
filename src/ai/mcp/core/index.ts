/**
 * MCP Tool Layer — core barrel.
 */
export { authorizeToolInvoke } from "@/ai/mcp/core/auth";
export { defaultDomainContextLoader } from "@/ai/mcp/core/domain-loader";
export { TOOL_ERROR, type ToolErrorCode } from "@/ai/mcp/core/errors";
export { hashInput, newToolCallId, redactInput } from "@/ai/mcp/core/hash";
export { invokeTool } from "@/ai/mcp/core/invoke";
export {
  clearToolRegistry,
  getTool,
  hasTool,
  listReadTools,
  listTools,
  listWriteTools,
  registerTool,
} from "@/ai/mcp/core/registry";
export {
  clearToolCallLog,
  findToolCall,
  listToolCalls,
  recordToolCall,
} from "@/ai/mcp/core/tool-call-log";
export type {
  DomainContextLoader,
  JsonSchemaLike,
  RegisteredTool,
  ToolDomainContext,
  ToolHandler,
  ToolInvokeRequest,
  ToolInvokeResult,
} from "@/ai/mcp/core/types";
export { defineReadTool, defineWriteTool } from "@/ai/mcp/core/define-tool";
export { validateToolInput, validateToolOutput } from "@/ai/mcp/core/validate";
