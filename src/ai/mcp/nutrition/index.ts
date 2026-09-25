/**
 * MCP nutrition tools (READ).
 */
import { defineReadTool } from "@/ai/mcp/core/define-tool";

export function registerNutritionTools(): void {
  defineReadTool({
    id: "get_nutrition",
    name: "get_nutrition",
    description: "Nutrition observed/derived slice for the trusted user",
    permission: "nutrition.read",
    mcp_namespace: "nutrition",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { date: { type: "string" } },
    },
    output_schema: { type: "object", required: ["nutrition"] },
    handler: (ctx) => {
      const pc = ctx.performanceContext;
      const mealsToday = (ctx.state.meals ?? []).filter(
        (m) => m.date.slice(0, 10) === ctx.date,
      ).length;
      return {
        nutrition: {
          mealsLoggedToday: pc?.observed.mealsLoggedToday ?? mealsToday,
          proteinAdherence7d: pc?.derived.proteinAdherence7d ?? null,
          kcalTrend: pc?.nutrition.kcalTrend ?? null,
          weightTrendKg7d: pc?.nutrition.weightTrendKg7d ?? null,
        },
      };
    },
  });
}
