/**
 * Helper to define a RegisteredTool with defaults.
 */
import type { RegisteredTool, ToolHandler, JsonSchemaLike } from "@/ai/mcp/core/types";
import { registerTool } from "@/ai/mcp/core/registry";

export function defineReadTool(opts: {
  id: string;
  name: string;
  description: string;
  permission: string;
  input_schema?: JsonSchemaLike;
  output_schema?: JsonSchemaLike;
  handler: ToolHandler;
  version?: string;
  mcp_namespace?: string;
}): RegisteredTool {
  const tool: RegisteredTool = {
    id: opts.id,
    name: opts.name,
    version: opts.version ?? "1",
    description: opts.description,
    access: "read",
    classification: "read",
    permission: opts.permission,
    authorization: "authenticated",
    mcp_namespace: opts.mcp_namespace ?? opts.id.split("_")[1] ?? "core",
    input_schema: opts.input_schema ?? {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    output_schema: opts.output_schema ?? { type: "object" },
    requires_safety_gate: false,
    requires_decision_authority: false,
    handler: opts.handler,
  };
  registerTool(tool);
  return tool;
}

export function defineWriteTool(opts: {
  id: string;
  name: string;
  description: string;
  permission: string;
  input_schema: JsonSchemaLike;
  output_schema?: JsonSchemaLike;
  version?: string;
  mcp_namespace?: string;
}): RegisteredTool {
  const tool: RegisteredTool = {
    id: opts.id,
    name: opts.name,
    version: opts.version ?? "1",
    description: opts.description,
    access: "write",
    classification: "write",
    permission: opts.permission,
    authorization: "authenticated",
    mcp_namespace: opts.mcp_namespace ?? "write",
    input_schema: opts.input_schema,
    output_schema: opts.output_schema ?? { type: "object", required: ["ok"] },
    requires_safety_gate: true,
    requires_decision_authority: true,
    // Never mutates — invoke pipeline denies write before handler; stub for completeness.
    handler: async () => ({ ok: false, error: "write_not_enabled" }),
  };
  registerTool(tool);
  return tool;
}
