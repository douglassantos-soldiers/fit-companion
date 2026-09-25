/**
 * MCP decision tools — recent decisions / outcomes (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";
import { toDecisionView } from "@/lib/engine/decision-contract";

export function registerDecisionTools(): void {
  defineReadTool({
    id: "get_recent_decisions",
    name: "get_recent_decisions",
    description: "Authoritative Decision contracts for the current context",
    permission: "decision.read",
    mcp_namespace: "decision",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        limit: { type: "integer" },
      },
    },
    output_schema: { type: "object", required: ["decisions"] },
    handler: (ctx, input) => {
      const limitRaw = input["limit"];
      const limit =
        typeof limitRaw === "number" && Number.isFinite(limitRaw)
          ? Math.min(40, Math.max(1, Math.floor(limitRaw)))
          : 12;
      const recent = ctx.performanceContext?.recent_decisions ?? [];
      return {
        decisions: recent.slice(0, limit).map((d) => ({
          decisionId: d.decision_id,
          decisionType: d.decision_type,
          decisionValue: d.decision_value ?? null,
          reasonAliases: d.reason_aliases,
          confidence: d.confidence,
          why: d.why,
          what: d.what,
          expectedOutcome: d.expected_outcome,
          view: toDecisionView(d),
        })),
        trainingMode: ctx.performanceContext?.decisions.trainingMode ?? null,
      };
    },
  });

  defineReadTool({
    id: "get_recent_outcomes",
    name: "get_recent_outcomes",
    description: "Recent outcome entries from PerformanceContext",
    permission: "decision.outcomes.read",
    mcp_namespace: "decision",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        limit: { type: "integer" },
      },
    },
    output_schema: { type: "object", required: ["outcomes"] },
    handler: (ctx, input) => {
      const limitRaw = input["limit"];
      const limit =
        typeof limitRaw === "number" && Number.isFinite(limitRaw)
          ? Math.min(40, Math.max(1, Math.floor(limitRaw)))
          : 10;
      const outcomes = ctx.performanceContext?.recent_outcomes ?? [];
      return { outcomes: outcomes.slice(0, limit) };
    },
  });
}
