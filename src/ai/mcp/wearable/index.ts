/**
 * MCP wearable tools (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";

export function registerWearableTools(): void {
  defineReadTool({
    id: "get_wearable_data",
    name: "get_wearable_data",
    description: "Wearable availability and vitals from PerformanceContext",
    permission: "wearable.read",
    mcp_namespace: "wearable",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["wearable"] },
    handler: (ctx) => {
      const pc = ctx.performanceContext;
      const connections = ctx.state.wearableConnections ?? [];
      return {
        wearable: pc?.wearable ?? {
          available: false,
          confidence: null,
          restingHr: null,
          hrv: null,
        },
        connections: connections.map((c) => ({
          provider: c.provider,
          status: c.status,
        })),
      };
    },
  });
}
