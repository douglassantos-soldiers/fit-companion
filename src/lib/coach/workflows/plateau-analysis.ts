import { actionsFromIds } from "@/lib/coach/actions";
import { evidenceFromContext } from "@/lib/coach/evidence";
import { makeProposal } from "@/lib/coach/proposals";
import type { CoachContext, WorkflowResult } from "@/lib/coach/types";
import { plateauExerciseIds } from "@/lib/engine/exercise-history";
import type { SessionLog } from "@/lib/types";

export function plateauAnalysisWorkflow(
  ctx: CoachContext,
  sessions: SessionLog[],
): WorkflowResult {
  const evidence = evidenceFromContext(ctx);
  const plateaus = plateauExerciseIds(sessions).slice(0, 8);
  const analysis: string[] = [];
  if (plateaus.length) {
    analysis.push(`Exercícios em plateau: ${plateaus.join(", ")}`);
  } else {
    analysis.push("Nenhum plateau claro nos exercícios com histórico");
  }
  if (ctx.training.sessions28d < 6) {
    analysis.push("Poucos treinos em 28d — plateau pode ser ruído de amostra");
  }
  if (ctx.recovery.hardRpeStreak >= 2) {
    analysis.push("RPE alto recente pode mascarar progressão");
  }

  const proposal =
    plateaus.length >= 2
      ? makeProposal(
          "DELOAD",
          0.7,
          ["plateau_detected"],
          { ...evidence, plateauCount: plateaus.length } as Record<
            string,
            string | number | boolean | null
          >,
          0.7,
        )
      : makeProposal(
          "FULL_WORKOUT",
          1,
          ["progression_ready"],
          evidence as Record<string, string | number | boolean | null>,
          0.55,
        );

  return {
    workflow: "plateau-analysis",
    analysis,
    proposal,
    outcomeExpectation: "Ajustar progressão ou deload pontual",
    evidence,
    actions: actionsFromIds(["adapt_workout", "open_training"]),
    risks: plateaus.length ? [`Plateau em ${plateaus.length} exercício(s)`] : [],
    nextFocus: plateaus.length ? "Variar estímulo / deload" : "Continuar sobrecarga progressiva",
    confidence: proposal.confidence,
  };
}
