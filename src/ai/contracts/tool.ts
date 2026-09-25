/**
 * Tool contract — authenticated capability boundary for agents/skills.
 * Execution MUST go through MCP Tool Layer (or server-side handlers) with authz.
 * Tools never grant agents direct database access.
 */

export type ToolAccess = "read" | "write" | "admin";

/** Read vs write classification for catalogs and governance. */
export type ToolClassification = "read" | "write";

export type ToolAuthorization = "authenticated" | "admin";

export type Tool = {
  id: string;
  name: string;
  version: string;
  description?: string;
  access: ToolAccess;
  classification: ToolClassification;
  permission: string;
  authorization: ToolAuthorization;
  /** MCP server / tool namespace when registered. */
  mcp_namespace?: string;
  /** Lightweight JSON-schema-like descriptor (fail-closed validated at runtime). */
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  input_schema_ref?: string;
  output_schema_ref?: string;
  /** If true, Safety Engine must approve before invocation. */
  requires_safety_gate: boolean;
  /** If true, Decision Engine must authorize before side effects. */
  requires_decision_authority: boolean;
};
