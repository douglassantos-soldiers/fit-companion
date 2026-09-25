/**
 * Recovery skills (deterministic).
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { asRecord, dateInput, requireToolData, skillOk } from "@/ai/skills/core/helpers";

export function registerRecoverySkills(): void {
  defineSkill({
    id: "analyze_sleep",
    name: "analyze_sleep",
    description: "Analyze sleep hours and provenance",
    domain: "recovery",
    required_tool_ids: ["get_sleep"],
    required_knowledge: ["kb:recovery.sleep"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const sleep = await requireToolData(ctx.callTool, "get_sleep", di);
      if (!sleep.ok) warnings.push(sleep.warning);
      const s = asRecord(asRecord(sleep.ok ? sleep.data : {})["sleep"]);
      const hours = typeof s["hours"] === "number" ? s["hours"] : null;
      if (hours != null && hours < 6) warnings.push("low_sleep");
      return skillOk(
        { hours, source: s["source"] ?? null, avg7d: s["avg7d"] ?? null },
        [{ signal: "sleepHours", value: hours, source: "get_sleep" }],
        hours == null ? 0.4 : 0.8,
        warnings,
      );
    },
  });

  defineSkill({
    id: "analyze_recovery",
    name: "analyze_recovery",
    description: "Analyze recovery score and readiness",
    domain: "recovery",
    required_tool_ids: ["get_recovery"],
    required_knowledge: ["kb:recovery.basics"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const recovery = await requireToolData(ctx.callTool, "get_recovery", di);
      if (!recovery.ok) warnings.push(recovery.warning);
      const r = asRecord(asRecord(recovery.ok ? recovery.data : {})["recovery"]);
      return skillOk(
        {
          score: r["score"] ?? null,
          level: r["level"] ?? null,
          readiness: r["readiness"] ?? null,
          fatigueSignal: Boolean(r["fatigueSignal"]),
        },
        [
          {
            signal: "recoveryScore",
            value: typeof r["score"] === "number" ? r["score"] : null,
            source: "get_recovery",
          },
        ],
        0.75,
        warnings,
      );
    },
  });

  defineSkill({
    id: "analyze_fatigue",
    name: "analyze_fatigue",
    description: "Combine recovery + wearable for fatigue view",
    domain: "recovery",
    required_tool_ids: ["get_recovery", "get_wearable_data"],
    required_knowledge: ["kb:recovery.fatigue"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const recovery = await requireToolData(ctx.callTool, "get_recovery", di);
      const wear = await requireToolData(ctx.callTool, "get_wearable_data", di);
      if (!recovery.ok) warnings.push(recovery.warning);
      if (!wear.ok) warnings.push(wear.warning);
      const r = asRecord(asRecord(recovery.ok ? recovery.data : {})["recovery"]);
      const w = asRecord(asRecord(wear.ok ? wear.data : {})["wearable"]);
      const fatigued = Boolean(r["fatigueSignal"]) || r["level"] === "low";
      return skillOk(
        {
          fatigued,
          wearableAvailable: Boolean(w["available"]),
          hrv: w["hrv"] ?? null,
        },
        [
          { signal: "fatigued", value: fatigued, source: "get_recovery" },
          {
            signal: "wearableAvailable",
            value: Boolean(w["available"]),
            source: "get_wearable_data",
          },
        ],
        0.72,
        warnings,
      );
    },
  });
}
