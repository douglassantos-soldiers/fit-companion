/**
 * MCP user tools — profile / goals (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";

export function registerUserTools(): void {
  defineReadTool({
    id: "get_user_profile",
    name: "get_user_profile",
    description: "Trusted user profile slice from PerformanceContext / AppState",
    permission: "user.profile.read",
    mcp_namespace: "user",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["profile"] },
    handler: (ctx) => {
      const p = ctx.state.profile;
      const pc = ctx.performanceContext;
      return {
        profile: p
          ? {
              name: p.name,
              goal: p.goal,
              level: p.level,
              daysPerWeek: p.daysPerWeek,
              equipment: p.equipment,
              timezone: p.timezone ?? pc?.timezone ?? null,
            }
          : null,
        identity: pc
          ? {
              userId: pc.identity.userId,
              date: pc.identity.date,
              timezone: pc.identity.timezone,
            }
          : { userId: ctx.userId, date: ctx.date, timezone: null },
      };
    },
  });

  defineReadTool({
    id: "get_user_goal",
    name: "get_user_goal",
    description: "Primary goal and equipment profile",
    permission: "user.goal.read",
    mcp_namespace: "user",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["goal"] },
    handler: (ctx) => {
      const pc = ctx.performanceContext;
      return {
        goal: pc?.goals.primary ?? ctx.state.profile?.goal ?? null,
        goals: pc?.goals ?? null,
        equipmentProfile: pc?.goals.equipmentProfile ?? ctx.state.profile?.equipment ?? null,
      };
    },
  });
}
