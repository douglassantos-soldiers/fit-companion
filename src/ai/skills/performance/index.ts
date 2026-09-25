/**
 * Performance skills (deterministic).
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { asRecord, dateInput, requireToolData, skillOk } from "@/ai/skills/core/helpers";

export function registerPerformanceSkills(): void {
  defineSkill({
    id: "analyze_performance",
    name: "analyze_performance",
    description: "Summarize recent decisions and outcomes",
    domain: "performance",
    required_tool_ids: ["get_recent_decisions", "get_recent_outcomes"],
    required_knowledge: ["kb:performance.overview"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const decisions = await requireToolData(ctx.callTool, "get_recent_decisions", di);
      const outcomes = await requireToolData(ctx.callTool, "get_recent_outcomes", di);
      if (!decisions.ok) warnings.push(decisions.warning);
      if (!outcomes.ok) warnings.push(outcomes.warning);
      const dList = (asRecord(decisions.ok ? decisions.data : {})["decisions"] as unknown[]) ?? [];
      const oList = (asRecord(outcomes.ok ? outcomes.data : {})["outcomes"] as unknown[]) ?? [];
      const mode = asRecord(decisions.ok ? decisions.data : {})["trainingMode"];
      return skillOk(
        {
          decisionCount: dList.length,
          outcomeCount: oList.length,
          trainingMode: mode ?? null,
        },
        [
          { signal: "decisionCount", value: dList.length, source: "get_recent_decisions" },
          { signal: "outcomeCount", value: oList.length, source: "get_recent_outcomes" },
        ],
        0.75,
        warnings,
      );
    },
  });

  defineSkill({
    id: "explain_decision",
    name: "explain_decision",
    description: "Expose WHY/WHAT/EXPECTED from recent decisions (no invented thresholds)",
    domain: "performance",
    kind: "explanation",
    required_tool_ids: ["get_recent_decisions"],
    required_knowledge: ["kb:performance.explain"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const decisions = await requireToolData(ctx.callTool, "get_recent_decisions", di);
      if (!decisions.ok) warnings.push(decisions.warning);
      const list =
        (asRecord(decisions.ok ? decisions.data : {})["decisions"] as Array<
          Record<string, unknown>
        >) ?? [];
      const primary = list[0] ?? null;
      return skillOk(
        {
          why: primary?.["why"] ?? null,
          what: primary?.["what"] ?? null,
          expectedOutcome: primary?.["expectedOutcome"] ?? null,
          decisionId: primary?.["decisionId"] ?? null,
        },
        [
          {
            signal: "decisionId",
            value: (primary?.["decisionId"] as string) ?? null,
            source: "get_recent_decisions",
          },
        ],
        primary ? 0.85 : 0.4,
        warnings,
      );
    },
  });

  defineSkill({
    id: "analyze_outcome",
    name: "analyze_outcome",
    description: "Aggregate recent outcomes",
    domain: "performance",
    required_tool_ids: ["get_recent_outcomes"],
    required_knowledge: ["kb:performance.outcomes"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const outcomes = await requireToolData(ctx.callTool, "get_recent_outcomes", di);
      if (!outcomes.ok) warnings.push(outcomes.warning);
      const list =
        (asRecord(outcomes.ok ? outcomes.data : {})["outcomes"] as Array<
          Record<string, unknown>
        >) ?? [];
      const kinds = [...new Set(list.map((o) => String(o["kind"] ?? "unknown")))];
      return skillOk(
        { count: list.length, kinds },
        [{ signal: "outcomeCount", value: list.length, source: "get_recent_outcomes" }],
        0.7,
        warnings,
      );
    },
  });

  defineSkill({
    id: "generate_daily_context",
    name: "generate_daily_context",
    description: "Assemble read-only daily context pack for Coach/Agents",
    domain: "performance",
    kind: "context_assembly",
    required_tool_ids: [
      "get_user_profile",
      "get_current_plan",
      "get_recovery",
      "get_recent_decisions",
    ],
    required_knowledge: ["kb:performance.daily"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const profile = await requireToolData(ctx.callTool, "get_user_profile", di);
      const plan = await requireToolData(ctx.callTool, "get_current_plan", di);
      const recovery = await requireToolData(ctx.callTool, "get_recovery", di);
      const decisions = await requireToolData(ctx.callTool, "get_recent_decisions", di);
      for (const r of [profile, plan, recovery, decisions]) {
        if (!r.ok) warnings.push(r.warning);
      }
      return skillOk(
        {
          date: ctx.date,
          profile: profile.ok ? profile.data : null,
          plan: plan.ok ? plan.data : null,
          recovery: recovery.ok ? recovery.data : null,
          decisions: decisions.ok ? decisions.data : null,
        },
        [{ signal: "date", value: ctx.date, source: "system" }],
        warnings.length ? 0.55 : 0.8,
        warnings,
      );
    },
  });
}
