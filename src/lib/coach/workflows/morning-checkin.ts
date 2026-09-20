import { actionsFromIds } from "@/lib/coach/actions";
import { evidenceFromContext } from "@/lib/coach/evidence";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachContext, WorkflowResult } from "@/lib/coach/types";

export function morningCheckinWorkflow(ctx: CoachContext): WorkflowResult {
  const evidence = evidenceFromContext(ctx);
  const analysis: string[] = [];
  if (ctx.recovery.sleepHours != null && ctx.recovery.sleepHours < 6) {
    analysis.push(`Sono baixo: ${ctx.recovery.sleepHours}h`);
  }
  if (ctx.recovery.energy === "baixa") analysis.push("Energia baixa no check-in");
  if (ctx.safety.preferLightTraining) analysis.push("Safety sugere treino leve");
  if (!analysis.length) analysis.push("Check-in estável — seguir plano do dia");

  const proposal = ctx.safety.escalateCare
    ? makeProposal("REST", true, ["escalate_care"], evidence as Record<string, string | number | boolean | null>, 0.9)
    : ctx.training.todayMode === "express" || (ctx.training.volumeFactor != null && ctx.training.volumeFactor < 0.85)
      ? makeProposal(
          "EXPRESS_WORKOUT",
          ctx.training.volumeFactor ?? 0.7,
          evidence.reasonCodes ?? [],
          evidence as Record<string, string | number | boolean | null>,
          0.75,
        )
      : makeProposal(
          "CHECKIN",
          true,
          [],
          evidence as Record<string, string | number | boolean | null>,
          0.6,
        );

  return {
    workflow: "morning-checkin",
    analysis,
    proposal,
    outcomeExpectation: "Usuário confirma check-in e segue living plan",
    evidence,
    actions: actionsFromIds(["start_checkin", "open_training", "open_nutrition"]),
    confidence: proposal.confidence,
  };
}
