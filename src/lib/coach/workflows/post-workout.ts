import { actionsFromIds } from "@/lib/coach/actions";
import { evidenceFromContext } from "@/lib/coach/evidence";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachContext, WorkflowResult } from "@/lib/coach/types";
import type { SessionLog } from "@/lib/types";
import { detectExercisePrs, detectSessionVolumePrs } from "@/lib/training/prs";

export function postWorkoutWorkflow(
  ctx: CoachContext,
  session: SessionLog | null,
  allSessions: SessionLog[],
): WorkflowResult {
  const evidence = evidenceFromContext(ctx);
  const analysis: string[] = [];
  const wins: string[] = [];
  const risks: string[] = [];

  if (session) {
    analysis.push(
      `Sessão ${session.title}: ${session.durationMin} min, volume ${Math.round(session.volumeKg)} kg, RPE ${session.rpe ?? "—"}`,
    );
    const volumePrs = detectSessionVolumePrs(allSessions).filter((p) => p.sessionId === session.id);
    for (const pr of volumePrs) wins.push(pr.label);
    for (const ex of session.exercises) {
      const prs = detectExercisePrs(ex.exerciseId, allSessions).filter((p) => p.sessionId === session.id);
      for (const pr of prs) wins.push(pr.label);
    }
    if (session.rpe === "dificil") {
      risks.push("RPE difícil — monitorar recuperação amanhã");
    }
    if (ctx.recovery.hardRpeStreak >= 3) {
      risks.push(`Streak de RPE difícil: ${ctx.recovery.hardRpeStreak}`);
    }
  } else {
    analysis.push("Nenhuma sessão recente para revisar");
  }

  if (!wins.length) wins.push("Sessão registrada — consistência mantida");

  const proposal =
    ctx.recovery.hardRpeStreak >= 3 || session?.rpe === "dificil"
      ? makeProposal(
          "INCREASE_RECOVERY",
          true,
          ["rpe_high"],
          { ...evidence, lastRpe: session?.rpe ?? null } as Record<string, string | number | boolean | null>,
          0.8,
        )
      : makeProposal(
          "FULL_WORKOUT",
          ctx.training.volumeFactor ?? 1,
          [],
          evidence as Record<string, string | number | boolean | null>,
          0.65,
        );

  return {
    workflow: "post-workout",
    analysis,
    proposal,
    outcomeExpectation: "Marcar outcome session_completed e ajustar próxima sessão",
    evidence,
    actions: actionsFromIds(["recommend_rest", "recommend_meal", "open_training"]),
    wins,
    risks,
    nextFocus: risks.length ? "Recuperação e sono" : "Progressão na próxima sessão",
    confidence: proposal.confidence,
  };
}
