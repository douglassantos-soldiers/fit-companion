import { actionsFromIds } from "@/lib/coach/actions";
import { evidenceFromContext } from "@/lib/coach/evidence";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachContext, WorkflowResult } from "@/lib/coach/types";

export function recoveryAdjustmentWorkflow(ctx: CoachContext): WorkflowResult {
  const evidence = evidenceFromContext(ctx);
  const analysis: string[] = [];
  if (ctx.recovery.sleepHours != null) analysis.push(`Sono: ${ctx.recovery.sleepHours}h`);
  if (ctx.recovery.level) analysis.push(`Nível recovery: ${ctx.recovery.level}`);
  if (ctx.recovery.hardRpeStreak) analysis.push(`Hard RPE streak: ${ctx.recovery.hardRpeStreak}`);
  if (ctx.safety.flags.length) analysis.push(`Safety flags: ${ctx.safety.flags.join(", ")}`);

  const needsRest =
    ctx.safety.escalateCare ||
    ctx.safety.preferLightTraining ||
    (ctx.recovery.sleepHours != null && ctx.recovery.sleepHours < 6) ||
    ctx.recovery.hardRpeStreak >= 3 ||
    ctx.recovery.level === "low";

  const proposal = needsRest
    ? makeProposal(
        ctx.safety.escalateCare ? "REST" : "INCREASE_RECOVERY",
        true,
        ctx.safety.flags,
        evidence as Record<string, string | number | boolean | null>,
        0.85,
      )
    : makeProposal(
        "SLEEP_FOCUS",
        true,
        ["sleep_low"],
        evidence as Record<string, string | number | boolean | null>,
        0.6,
      );

  return {
    workflow: "recovery-adjustment",
    analysis: analysis.length ? analysis : ["Recovery estável"],
    proposal,
    outcomeExpectation: "Reduzir carga ou priorizar sono nas próximas 24h",
    evidence,
    actions: actionsFromIds(["recommend_rest", "recommend_sleep", "recommend_hydration"]),
    confidence: proposal.confidence,
  };
}
