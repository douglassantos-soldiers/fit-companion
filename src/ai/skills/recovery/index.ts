/**
 * Recovery skills (deterministic).
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { asRecord, dateInput, requireToolData, skillOk } from "@/ai/skills/core/helpers";
import { makeSkillProposal } from "@/ai/skills/core/proposal";

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
      const proposal =
        hours != null && hours < 5.5
          ? makeSkillProposal({
              skillId: ctx.skillId,
              userId: ctx.userId,
              proposedType: "SLEEP_FOCUS",
              proposedValue: "sleep",
              reasonCodes: ["sleep_low"],
              confidence: 0.78,
              note: "prioritize_sleep",
            })
          : null;
      return skillOk(
        { hours, source: s["source"] ?? null, avg7d: s["avg7d"] ?? null },
        [{ signal: "sleepHours", value: hours, source: "get_sleep" }],
        hours == null ? 0.4 : 0.8,
        warnings,
        proposal,
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
      const level = String(r["level"] ?? "");
      const score = typeof r["score"] === "number" ? r["score"] : null;
      const proposal =
        level === "low" || (score != null && score < 45)
          ? makeSkillProposal({
              skillId: ctx.skillId,
              userId: ctx.userId,
              proposedType: "INCREASE_RECOVERY",
              proposedValue: "recover",
              reasonCodes: ["recovery_low"],
              confidence: 0.76,
            })
          : null;
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
            value: score,
            source: "get_recovery",
          },
        ],
        0.75,
        warnings,
        proposal,
      );
    },
  });

  defineSkill({
    id: "analyze_fatigue",
    name: "analyze_fatigue",
    description: "Combine recovery + wearable for fatigue view; may propose REST/EXPRESS/DELOAD",
    domain: "recovery",
    kind: "proposal",
    required_tool_ids: ["get_recovery", "get_wearable_data"],
    required_knowledge: ["kb:recovery.fatigue"],
    safety_requirements: {
      requires_decision_authority: true,
      proposal_only_for_side_effects: true,
      requires_safety_gate: true,
    },
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
      const score = typeof r["score"] === "number" ? r["score"] : null;

      let proposal = null;
      if (fatigued && (score == null || score < 40)) {
        proposal = makeSkillProposal({
          skillId: ctx.skillId,
          userId: ctx.userId,
          proposedType: "REST",
          proposedValue: "rest",
          reasonCodes: ["fatigue_high", "recovery_low"],
          confidence: 0.82,
        });
      } else if (fatigued) {
        proposal = makeSkillProposal({
          skillId: ctx.skillId,
          userId: ctx.userId,
          proposedType: "EXPRESS_WORKOUT",
          proposedValue: "express",
          reasonCodes: ["fatigue_signal"],
          confidence: 0.74,
        });
      } else if (score != null && score < 55) {
        proposal = makeSkillProposal({
          skillId: ctx.skillId,
          userId: ctx.userId,
          proposedType: "DELOAD",
          proposedValue: "deload",
          reasonCodes: ["recovery_moderate_low"],
          confidence: 0.7,
        });
      }

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
          {
            signal: "recoveryScore",
            value: score,
            source: "get_recovery",
          },
        ],
        0.72,
        warnings,
        proposal,
      );
    },
  });
}
