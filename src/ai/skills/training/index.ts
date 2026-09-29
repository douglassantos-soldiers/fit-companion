/**
 * Training skills (deterministic).
 */
import { defineSkill } from "@/ai/skills/core/define-skill";
import { asRecord, dateInput, requireToolData, skillOk } from "@/ai/skills/core/helpers";
import { makeSkillProposal } from "@/ai/skills/core/proposal";

export function registerTrainingSkills(): void {
  defineSkill({
    id: "analyze_training",
    name: "analyze_training",
    description: "Summarize recent training history and current plan mode",
    domain: "training",
    required_tool_ids: ["get_training_history", "get_current_plan"],
    required_knowledge: ["kb:training.basics"],
    execute: async (ctx, input) => {
      const warnings: string[] = [];
      const di = dateInput(ctx, input);
      const hist = await requireToolData(ctx.callTool, "get_training_history", {
        ...di,
        limit: 10,
      });
      const plan = await requireToolData(ctx.callTool, "get_current_plan", di);
      if (!hist.ok) warnings.push(hist.warning);
      if (!plan.ok) warnings.push(plan.warning);
      const sessions = (asRecord(hist.ok ? hist.data : {})["sessions"] as unknown[]) ?? [];
      const planData = asRecord(plan.ok ? plan.data : {});
      const decisions = asRecord(planData["decisions"]);
      const planInfo = asRecord(planData["plan"]);
      const trainingMode = decisions["trainingMode"] ?? planInfo["workoutMode"];
      const mode =
        typeof trainingMode === "string" &&
        ["full", "express", "rest", "deload"].includes(trainingMode)
          ? trainingMode
          : null;
      // Always emit an engine-aligned mode proposal so deterministic specialists
      // produce DecisionProposal candidates (FASE 23 natural E2E path).
      const proposal =
        mode === "full"
          ? makeSkillProposal({
              skillId: ctx.skillId,
              userId: ctx.userId,
              proposedType: "FULL_WORKOUT",
              proposedValue: "full",
              reasonCodes: ["plan_mode_confirm", "analyze_training"],
              confidence: warnings.length ? 0.6 : 0.78,
            })
          : mode === "express"
            ? makeSkillProposal({
                skillId: ctx.skillId,
                userId: ctx.userId,
                proposedType: "EXPRESS_WORKOUT",
                proposedValue: "express",
                reasonCodes: ["plan_mode_confirm", "analyze_training"],
                confidence: warnings.length ? 0.6 : 0.78,
              })
            : mode === "rest"
              ? makeSkillProposal({
                  skillId: ctx.skillId,
                  userId: ctx.userId,
                  proposedType: "REST",
                  proposedValue: "rest",
                  reasonCodes: ["plan_mode_confirm", "analyze_training"],
                  confidence: warnings.length ? 0.6 : 0.78,
                })
              : mode === "deload"
                ? makeSkillProposal({
                    skillId: ctx.skillId,
                    userId: ctx.userId,
                    proposedType: "DELOAD",
                    proposedValue: 0.55,
                    reasonCodes: ["plan_mode_confirm", "analyze_training"],
                    confidence: warnings.length ? 0.6 : 0.78,
                  })
                : null;
      return skillOk(
        {
          sessionCount: sessions.length,
          trainingMode: mode,
          trainingVolume: decisions["trainingVolume"] ?? null,
          plan: planData["plan"] ?? null,
        },
        [
          { signal: "sessionCount", value: sessions.length, source: "get_training_history" },
          {
            signal: "trainingMode",
            value: mode,
            source: "get_current_plan",
          },
        ],
        warnings.length ? 0.55 : 0.8,
        warnings,
        proposal,
      );
    },
  });

  defineSkill({
    id: "select_exercise",
    name: "select_exercise",
    description: "Heuristic exercise pick from recent history",
    domain: "training",
    required_tool_ids: ["get_training_history"],
    required_knowledge: ["kb:training.exercises"],
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const hist = await requireToolData(ctx.callTool, "get_training_history", { ...di, limit: 5 });
      const warnings: string[] = [];
      if (!hist.ok) warnings.push(hist.warning);
      const sessions =
        (asRecord(hist.ok ? hist.data : {})["sessions"] as Array<{ title?: string }>) ?? [];
      const pick = sessions[0]?.title ?? "compound_movement";
      return skillOk(
        { selected: pick, rationale: "most_recent_session_title_or_default" },
        [{ signal: "selected_exercise", value: pick, source: "get_training_history" }],
        0.6,
        warnings,
      );
    },
  });

  defineSkill({
    id: "substitute_exercise",
    name: "substitute_exercise",
    description: "Suggest a substitute for a session exercise (heuristic)",
    domain: "training",
    required_tool_ids: ["get_training_session"],
    required_knowledge: ["kb:training.substitutions"],
    input_schema: {
      type: "object",
      required: ["sessionId"],
      additionalProperties: false,
      properties: {
        sessionId: { type: "string" },
        exerciseHint: { type: "string" },
        date: { type: "string" },
      },
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const sessionId = String(input["sessionId"] ?? "");
      const sess = await requireToolData(ctx.callTool, "get_training_session", {
        ...di,
        sessionId,
      });
      const warnings: string[] = [];
      if (!sess.ok) warnings.push(sess.warning);
      const hint = typeof input["exerciseHint"] === "string" ? input["exerciseHint"] : "primary";
      const substitute = `${hint}_alt`;
      return skillOk(
        {
          sessionId,
          originalHint: hint,
          substitute,
          session: asRecord(sess.ok ? sess.data : {})["session"] ?? null,
        },
        [{ signal: "substitute", value: substitute, source: "heuristic" }],
        0.55,
        warnings,
      );
    },
  });

  defineSkill({
    id: "adjust_training_load",
    name: "adjust_training_load",
    description: "Propose load adjustment from recovery signals (no mutation)",
    domain: "training",
    kind: "proposal",
    required_tool_ids: ["get_recovery", "get_current_plan"],
    required_knowledge: ["kb:training.load"],
    safety_requirements: {
      requires_decision_authority: true,
      proposal_only_for_side_effects: true,
      requires_safety_gate: false,
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const recovery = await requireToolData(ctx.callTool, "get_recovery", di);
      const plan = await requireToolData(ctx.callTool, "get_current_plan", di);
      if (!recovery.ok) warnings.push(recovery.warning);
      if (!plan.ok) warnings.push(plan.warning);
      const rec = asRecord(asRecord(recovery.ok ? recovery.data : {})["recovery"]);
      const fatigue = Boolean(rec["fatigueSignal"]);
      const level = String(rec["level"] ?? "");
      const shouldReduce = fatigue || level === "low";
      const proposal = shouldReduce
        ? makeSkillProposal({
            skillId: ctx.skillId,
            userId: ctx.userId,
            proposedType: "REDUCE_VOLUME",
            proposedValue: 0.7,
            reasonCodes: fatigue ? ["recovery_low", "energy_low"] : ["recovery_low"],
            confidence: 0.75,
          })
        : null;
      return skillOk(
        { shouldReduce, recoveryLevel: level || null, fatigue },
        [
          { signal: "fatigueSignal", value: fatigue, source: "get_recovery" },
          { signal: "recoveryLevel", value: level || null, source: "get_recovery" },
        ],
        shouldReduce ? 0.75 : 0.7,
        warnings,
        proposal,
      );
    },
  });

  defineSkill({
    id: "progression",
    name: "progression",
    description: "Propose progression when history supports it",
    domain: "training",
    kind: "proposal",
    required_tool_ids: ["get_training_history", "get_recent_decisions"],
    required_knowledge: ["kb:training.progression"],
    safety_requirements: {
      requires_decision_authority: true,
      proposal_only_for_side_effects: true,
      requires_safety_gate: false,
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const hist = await requireToolData(ctx.callTool, "get_training_history", { ...di, limit: 8 });
      const decisions = await requireToolData(ctx.callTool, "get_recent_decisions", di);
      if (!hist.ok) warnings.push(hist.warning);
      if (!decisions.ok) warnings.push(decisions.warning);
      const sessions = (asRecord(hist.ok ? hist.data : {})["sessions"] as unknown[]) ?? [];
      const ready = sessions.length >= 3;
      const proposal = ready
        ? makeSkillProposal({
            skillId: ctx.skillId,
            userId: ctx.userId,
            proposedType: "PROGRESSION",
            proposedValue: true,
            reasonCodes: ["progression_ready"],
            confidence: 0.65,
          })
        : null;
      return skillOk(
        { ready, sessionCount: sessions.length },
        [{ signal: "sessionCount", value: sessions.length, source: "get_training_history" }],
        0.65,
        warnings,
        proposal,
      );
    },
  });

  defineSkill({
    id: "regression",
    name: "regression",
    description: "Propose regression/deload when load is high",
    domain: "training",
    kind: "proposal",
    required_tool_ids: ["get_training_history", "get_recent_decisions"],
    required_knowledge: ["kb:training.regression"],
    safety_requirements: {
      requires_decision_authority: true,
      proposal_only_for_side_effects: true,
      requires_safety_gate: false,
    },
    execute: async (ctx, input) => {
      const di = dateInput(ctx, input);
      const warnings: string[] = [];
      const hist = await requireToolData(ctx.callTool, "get_training_history", { ...di, limit: 8 });
      const decisions = await requireToolData(ctx.callTool, "get_recent_decisions", di);
      if (!hist.ok) warnings.push(hist.warning);
      if (!decisions.ok) warnings.push(decisions.warning);
      const mode = asRecord(decisions.ok ? decisions.data : {})["trainingMode"];
      const needRegression = mode === "deload" || mode === "rest";
      const proposal = needRegression
        ? makeSkillProposal({
            skillId: ctx.skillId,
            userId: ctx.userId,
            proposedType: "DELOAD",
            proposedValue: 0.55,
            reasonCodes: ["deload_week", "recovery_low"],
            confidence: 0.7,
          })
        : null;
      return skillOk(
        { needRegression, trainingMode: mode ?? null },
        [
          {
            signal: "trainingMode",
            value: (mode as string) ?? null,
            source: "get_recent_decisions",
          },
        ],
        0.7,
        warnings,
        proposal,
      );
    },
  });
}
