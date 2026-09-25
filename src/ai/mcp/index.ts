/**
 * MCP / Tool Layer — Performance OS.
 *
 * Internal Tool Layer first (MCP-compatible). Protocol transport comes later.
 * Agents call invokeTool → Auth → Validate → Domain — never Agent → DB.
 *
 * Coach allowlist remains in src/lib/coach/tools.ts until migrated onto this layer.
 */

export type { Tool, ToolAccess, ToolAuthorization, ToolClassification } from "@/ai/contracts/tool";
export type { ToolCall, ToolCallStatus } from "@/ai/contracts/tool-call";

export {
  TOOL_ERROR,
  authorizeToolInvoke,
  clearToolCallLog,
  clearToolRegistry,
  defaultDomainContextLoader,
  findToolCall,
  getTool,
  hasTool,
  hashInput,
  invokeTool,
  listReadTools,
  listToolCalls,
  listTools,
  listWriteTools,
  redactInput,
  registerTool,
  validateToolInput,
  validateToolOutput,
} from "@/ai/mcp/core";
export type {
  DomainContextLoader,
  RegisteredTool,
  ToolDomainContext,
  ToolInvokeRequest,
  ToolInvokeResult,
} from "@/ai/mcp/core";
export { defineReadTool, defineWriteTool } from "@/ai/mcp/core/define-tool";
export { registerAllMcpTools } from "@/ai/mcp/register";

import { registerAllMcpTools } from "@/ai/mcp/register";

/** Eager default catalog for product use. Tests may clear + re-register. */
registerAllMcpTools();
