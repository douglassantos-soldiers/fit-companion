/**
 * MCP Tool Layer — runtime types.
 */
import type { Tool, ToolAuthorization, ToolClassification } from "@/ai/contracts/tool";
import type { ToolCall } from "@/ai/contracts/tool-call";
import type { TrustedUserId } from "@/ai/contracts/trusted-user-id";
import type { PerformanceContext } from "@/lib/engine/performance-context";
import type { AppState } from "@/lib/types";

export type JsonSchemaLike = {
  type?: string;
  required?: string[];
  properties?: Record<
    string,
    {
      type?: string | string[];
      enum?: Array<string | number | boolean>;
    }
  >;
  additionalProperties?: boolean;
};

export type ToolDomainContext = {
  userId: TrustedUserId;
  date: string;
  state: AppState;
  performanceContext: PerformanceContext | null;
};

export type DomainContextLoader = (
  userId: TrustedUserId,
  date?: string,
) => Promise<ToolDomainContext>;

export type ToolHandler = (
  ctx: ToolDomainContext,
  input: Record<string, unknown>,
) => Promise<unknown> | unknown;

export type RegisteredTool = Tool & {
  classification: ToolClassification;
  permission: string;
  authorization: ToolAuthorization;
  input_schema: JsonSchemaLike;
  output_schema: JsonSchemaLike;
  handler: ToolHandler;
};

export type ToolInvokeRequest = {
  toolId: string;
  /** null / empty = anonymous */
  trustedUserId: string | null;
  input?: unknown;
  /** If set and ≠ trustedUserId → IDOR deny */
  targetUserId?: string;
  agentId?: string;
  runId?: string;
  timeoutMs?: number;
  /** Test / DI override */
  loader?: DomainContextLoader;
};

export type ToolInvokeResult = {
  ok: boolean;
  status: ToolCall["status"];
  data?: unknown;
  error_code?: string;
  error_message?: string;
  tool_call: ToolCall;
};
