/**
 * Safety Engine — contraindications and soft guards before recommendations / AI.
 * Pure TypeScript; no network. Does not diagnose.
 * Date-aware: always evaluate against the same calendar date as Living Plan / Today.
 */
import { computeRecoverySnapshot, type RecoverySnapshot } from "@/lib/engine/recovery";
import type { AppState, Goal } from "@/lib/types";
import { getUserTodayKey, DEFAULT_USER_TIMEZONE } from "@/lib/timezone";

export type SafetyFlag =
  | "low_sleep"
  | "high_fatigue"
  | "hard_rpe_streak"
  | "stim_restriction"
  | "medical_disclaimer"
  | "under_recovery"
  | "escalate_care"
  | "pain_signal"
  | "high_stress";

export type SafetyVerdict = {
  ok: boolean;
  flags: SafetyFlag[];
  reasons: string[];
  blockStims: boolean;
  preferLightTraining: boolean;
  requireMedicalDisclaimer: boolean;
  /** Serious signals — do not treat as routine training adaptation. */
  escalateCare: boolean;
  /** Calendar date used for evaluation */
  date: string;
};

/** Non-diagnostic keyword scan for potentially serious check-in notes. */
const ESCALATE_NOTE_RE =
  /\b(dor\s+no\s+peito|dor\s+no\s+cora[cç][aã]o|falta\s+de\s+ar|n[aã]o\s+consigo\s+respirar|desmaio|desmaiei|tontura\s+forte|sangramento|peito\s+apertando|chest\s+pain|shortness\s+of\s+breath|fainted|seizure|convuls[aã]o)\b/i;

export function notesSuggestEscalation(notes: string | null | undefined): boolean {
  if (!notes?.trim()) return false;
  return ESCALATE_NOTE_RE.test(notes);
}

export type SafetyInput = Pick<AppState, "dayCheckIns" | "sessions" | "profile">;

/**
 * Evaluate safety for a specific calendar date (YYYY-MM-DD).
 * Prefer this over evaluateSafety when building plans for a target day.
 */
export function evaluateSafetyForDate(
  state: SafetyInput,
  date: string,
  recovery?: RecoverySnapshot,
): SafetyVerdict {
  const flags: SafetyFlag[] = ["medical_disclaimer"];
  const reasons: string[] = [
    "O Coach não substitui orientação médica — ajuste se sentir dor ou mal-estar.",
  ];

  const checkIn = state.dayCheckIns?.[date];
  let blockStims = false;
  let preferLightTraining = false;
  let escalateCare = false;

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
    if (checkIn.soreness != null && checkIn.soreness >= 4) {
      flags.push("under_recovery");
      reasons.push("Dor muscular alta no check-in — priorize recuperação.");
      preferLightTraining = true;
    }
    if (checkIn.soreness != null && checkIn.soreness >= 5) {
      flags.push("pain_signal");
      reasons.push(
        "Sinal de dor intensa no check-in — não trate como ajuste de treino comum. Se a dor for aguda ou incomum, procure um profissional de saúde.",
      );
      escalateCare = true;
      preferLightTraining = true;
      blockStims = true;
    }
    if (checkIn.stress != null && checkIn.stress >= 5) {
      flags.push("high_stress");
      reasons.push("Estresse máximo no check-in — priorize descanso e sono.");
      preferLightTraining = true;
    }
    if (
      checkIn.soreness != null &&
      checkIn.stress != null &&
      checkIn.soreness >= 4 &&
      checkIn.stress >= 4
    ) {
      escalateCare = true;
      preferLightTraining = true;
      if (!flags.includes("pain_signal")) flags.push("pain_signal");
      reasons.push(
        "Dor e estresse elevados juntos — foque em recuperação; não é só deload de volume.",
      );
    }
    if (notesSuggestEscalation(checkIn.notes)) {
      flags.push("escalate_care");
      escalateCare = true;
      preferLightTraining = true;
      blockStims = true;
      reasons.push(
        "Seu check-in menciona um sinal que merece atenção profissional. Não é adaptação de treino — pause o estímulo intenso e procure avaliação adequada se os sintomas persistirem.",
      );
    }
  }

  const recent = [...(state.sessions ?? [])]
    .filter((s) => s.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (recent.length >= 3 && recent.every((s) => s.rpe === "dificil")) {
    flags.push("hard_rpe_streak");
    reasons.push("Três sessões difíceis seguidas — considere deload.");
    preferLightTraining = true;
  }

  try {
    const snap = recovery ?? computeRecoverySnapshot(state as AppState, date);
    if (snap.readiness === "low") {
      flags.push("under_recovery");
      reasons.push(snap.explanation);
      preferLightTraining = true;
      if (snap.reasonCodes.includes("sleep_low")) {
        blockStims = true;
      }
    }
  } catch {
    /* incomplete state */
  }

  if (escalateCare) {
    flags.push("escalate_care");
  }
  if (blockStims) flags.push("stim_restriction");

  return {
    ok: !escalateCare,
    flags: [...new Set(flags)],
    reasons,
    blockStims,
    preferLightTraining,
    requireMedicalDisclaimer: true,
    escalateCare,
    date,
  };
}

/** Evaluate safety for "today" in the user's timezone (or default BR). */
export function evaluateSafety(
  state: SafetyInput,
  opts?: { date?: string; timezone?: string | null },
): SafetyVerdict {
  const date =
    opts?.date ??
    getUserTodayKey(opts?.timezone ?? state.profile?.timezone ?? DEFAULT_USER_TIMEZONE);
  return evaluateSafetyForDate(state, date);
}

export function safetyToneForGoal(goal: Goal | undefined): "neutral" | "conservative" {
  if (goal === "saude") return "conservative";
  return "neutral";
}
