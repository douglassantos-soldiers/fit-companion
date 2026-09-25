/**
 * MCP training tools — plan / history / session (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";

export function registerTrainingTools(): void {
  defineReadTool({
    id: "get_current_plan",
    name: "get_current_plan",
    description: "Today living plan / decision-backed workout mode",
    permission: "training.plan.read",
    mcp_namespace: "training",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["plan"] },
    handler: (ctx) => {
      const plan = ctx.state.livingPlans?.[ctx.date] ?? null;
      const pc = ctx.performanceContext;
      return {
        plan: plan
          ? {
              date: plan.date,
              workoutMode: plan.workout?.mode ?? null,
              sessionDuration: plan.workout?.estimatedMin ?? null,
              volumeFactor: plan.workout?.volumeFactor ?? null,
              narrative: plan.narrative ?? null,
            }
          : null,
        decisions: pc
          ? {
              trainingMode: pc.decisions.trainingMode,
              trainingVolume: pc.decisions.trainingVolume,
              sessionDuration: pc.decisions.sessionDuration,
              primaryAction: pc.decisions.primaryAction,
            }
          : null,
      };
    },
  });

  defineReadTool({
    id: "get_training_history",
    name: "get_training_history",
    description: "Recent training sessions for the trusted user",
    permission: "training.history.read",
    mcp_namespace: "training",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        limit: { type: "integer" },
      },
    },
    output_schema: { type: "object", required: ["sessions"] },
    handler: (ctx, input) => {
      const limitRaw = input["limit"];
      const limit =
        typeof limitRaw === "number" && Number.isFinite(limitRaw)
          ? Math.min(40, Math.max(1, Math.floor(limitRaw)))
          : 10;
      const sessions = [...(ctx.state.sessions ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          date: s.date,
          title: s.title,
          durationMin: s.durationMin,
          volumeKg: s.volumeKg,
          rpe: s.rpe ?? null,
          express: s.express ?? false,
        }));
      return {
        sessions,
        sessions7d: ctx.performanceContext?.observed.sessions7d ?? sessions.length,
      };
    },
  });

  defineReadTool({
    id: "get_training_session",
    name: "get_training_session",
    description: "Single session by id, scoped to trusted user state",
    permission: "training.session.read",
    mcp_namespace: "training",
    input_schema: {
      type: "object",
      required: ["sessionId"],
      additionalProperties: false,
      properties: {
        sessionId: { type: "string" },
        date: { type: "string" },
      },
    },
    output_schema: { type: "object", required: ["session"] },
    handler: (ctx, input) => {
      const sessionId = String(input["sessionId"] ?? "");
      const session = (ctx.state.sessions ?? []).find((s) => s.id === sessionId) ?? null;
      return {
        session: session
          ? {
              id: session.id,
              date: session.date,
              title: session.title,
              durationMin: session.durationMin,
              volumeKg: session.volumeKg,
              rpe: session.rpe ?? null,
              exerciseCount: session.exercises?.length ?? 0,
            }
          : null,
      };
    },
  });
}
