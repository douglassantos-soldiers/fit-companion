/**
 * MCP recovery / sleep tools (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";

export function registerRecoveryTools(): void {
  defineReadTool({
    id: "get_sleep",
    name: "get_sleep",
    description: "Sleep hours with provenance when available",
    permission: "recovery.sleep.read",
    mcp_namespace: "recovery",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["sleep"] },
    handler: (ctx) => {
      const pc = ctx.performanceContext;
      const checkIn = ctx.state.dayCheckIns?.[ctx.date];
      return {
        sleep: {
          hours: pc?.sleep.hours ?? checkIn?.sleepHours ?? null,
          avg7d: pc?.sleep.avg7d ?? null,
          source: pc?.sleep.source ?? (checkIn ? "checkin" : "unknown"),
          signal: pc?.signals.sleepHours ?? null,
        },
      };
    },
  });

  defineReadTool({
    id: "get_recovery",
    name: "get_recovery",
    description: "Recovery score / readiness / fatigue",
    permission: "recovery.read",
    mcp_namespace: "recovery",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["recovery"] },
    handler: (ctx) => {
      const pc = ctx.performanceContext;
      return {
        recovery: {
          score: pc?.derived.recoveryScore ?? pc?.recovery.score ?? null,
          level: pc?.derived.recoveryLevel ?? pc?.recovery.level ?? null,
          readiness: pc?.derived.recoveryReadiness ?? pc?.recovery.readiness ?? null,
          fatigueSignal: pc?.recovery.fatigueSignal ?? false,
          constraints: pc?.constraints ?? null,
        },
      };
    },
  });
}
