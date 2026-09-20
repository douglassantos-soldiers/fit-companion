import { exerciseById } from "@/data/exercises";
import { currentPersonalRecords } from "@/lib/training/prs";
import { weekOverWeek } from "@/lib/engine/dimensions";
import type { AppState } from "@/lib/types";

export type TrainingProof = {
  text: string;
  exerciseId?: string;
};

/** One-line proof for home — prefers a recent PR, then weekly volume. */
export function trainingProofLine(state: AppState): TrainingProof | null {
  const prs = currentPersonalRecords(state.sessions).filter((p) => p.exerciseId && p.prType === "WEIGHT_PR");
  const latest = prs[0];
  if (latest?.exerciseId && latest.previousValue != null && latest.value > latest.previousValue) {
    const name = exerciseById(latest.exerciseId)?.name ?? "Exercício";
    const delta = Math.round((latest.value - latest.previousValue) * 10) / 10;
    return {
      text: `${name} +${delta} kg`,
      exerciseId: latest.exerciseId,
    };
  }
  if (latest?.exerciseId) {
    const name = exerciseById(latest.exerciseId)?.name ?? "Exercício";
    return {
      text: `PR · ${name} ${latest.value} kg`,
      exerciseId: latest.exerciseId,
    };
  }
  const wow = weekOverWeek(state.sessions);
  if (wow?.volumeDeltaPct != null && Math.abs(wow.volumeDeltaPct) >= 5) {
    const sign = wow.volumeDeltaPct > 0 ? "+" : "";
    return { text: `Volume ${sign}${Math.round(wow.volumeDeltaPct)}% vs semana passada` };
  }
  if (state.sessions.length > 0) {
    return { text: `${state.sessions.length} treino${state.sessions.length === 1 ? "" : "s"} registrados` };
  }
  return null;
}
