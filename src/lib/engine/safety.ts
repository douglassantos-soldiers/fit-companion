/**
 * Safety Engine — contraindications and soft guards before recommendations / AI.
 * Pure TypeScript; no network.
 */
import type { AppState, Goal } from "@/lib/types";

export type SafetyFlag =
  | "low_sleep"
  | "high_fatigue"
  | "hard_rpe_streak"
  | "stim_restriction"
  | "medical_disclaimer"
  | "under_recovery";

export type SafetyVerdict = {
  ok: boolean;
  flags: SafetyFlag[];
  reasons: string[];
  blockStims: boolean;
  preferLightTraining: boolean;
  requireMedicalDisclaimer: boolean;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function evaluateSafety(
  state: Pick<AppState, "dayCheckIns" | "sessions" | "profile">,
): SafetyVerdict {
  const flags: SafetyFlag[] = ["medical_disclaimer"];
  const reasons: string[] = [
    "O Coach não substitui orientação médica — ajuste se sentir dor ou mal-estar.",
  ];

  const checkIn = state.dayCheckIns?.[todayKey()];
  let blockStims = false;
  let preferLightTraining = false;

  if (checkIn) {
    if (checkIn.sleepHours < 6) {
      flags.push("low_sleep");
      reasons.push("Sono baixo — evite estimulantes e prefira treino leve.");
      blockStims = true;
      preferLightTraining = true;
    }
    if (checkIn.energy === "baixa") {
      flags.push("high_fatigue");
      reasons.push("Energia baixa — priorize recuperação.");
      preferLightTraining = true;
    }
  }

  const recent = [...(state.sessions ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (recent.length >= 3 && recent.every((s) => s.rpe === "dificil")) {
    flags.push("hard_rpe_streak");
    reasons.push("Três sessões difíceis seguidas — considere deload.");
    preferLightTraining = true;
  }

  if (blockStims) flags.push("stim_restriction");

  return {
    ok: true,
    flags: [...new Set(flags)],
    reasons,
    blockStims,
    preferLightTraining,
    requireMedicalDisclaimer: true,
  };
}

export function safetyToneForGoal(goal: Goal | undefined): "neutral" | "conservative" {
  if (goal === "saude") return "conservative";
  return "neutral";
}
