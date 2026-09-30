/**
 * Safety Engine — contraindications and soft guards before recommendations / AI.
 * Pure TypeScript; no network. Does not diagnose.
 * Date-aware: always evaluate against the same calendar date as Living Plan / Today.
 * Levels + SAF-* IDs aligned with docs/knowledge/safety-knowledge-001.md (pinned).
 */
import { SLEEP_LOW_HOURS } from "@/lib/engine/decision-thresholds";
import {
  matchSafetyNotes,
  notesSuggestEscalation,
  type SafetyLevel,
} from "@/lib/engine/safety-knowledge-rules";
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
  /** SAFKD level (GREEN/YELLOW/RED/EMERGENCY). */
  level: SafetyLevel;
  /** Matched SAF-* rule ids. */
  ruleIds: string[];
  /** Fixed EMERGENCY/RED copy — never LLM-generated. */
  fixedMessage?: string;
  /** SAF-005: no product / commerce mentions when not GREEN. */
  blockCommerce: boolean;
};

export { notesSuggestEscalation, matchSafetyNotes };
export type { SafetyLevel };

export type SafetyInput = Pick<AppState, "dayCheckIns" | "sessions" | "profile">;

function maxLevel(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  const rank: Record<SafetyLevel, number> = {
    GREEN: 0,
    YELLOW: 1,
    RED: 2,
    EMERGENCY: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

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
  const ruleIds: string[] = [];

  const checkIn = state.dayCheckIns?.[date];
  let blockStims = false;
  let preferLightTraining = false;
  let level: SafetyLevel = "GREEN";
  let fixedMessage: string | undefined;

  if (checkIn) {
    if (checkIn.sleepHours < SLEEP_LOW_HOURS) {
      flags.push("low_sleep");
      reasons.push("Sono baixo — evite estimulantes e prefira treino leve.");
      blockStims = true;
      preferLightTraining = true;
      level = maxLevel(level, "YELLOW");
    }
    if (checkIn.energy === "baixa") {
      flags.push("high_fatigue");
      reasons.push("Energia baixa — priorize recuperação.");
      preferLightTraining = true;
      level = maxLevel(level, "YELLOW");
    }
    // SAF-160: soreness/stress alone are readiness, not EMERGENCY.
    if (checkIn.soreness != null && checkIn.soreness >= 4) {
      flags.push("under_recovery");
      reasons.push("Dor muscular alta no check-in — priorize recuperação.");
      preferLightTraining = true;
      level = maxLevel(level, "YELLOW");
    }
    if (checkIn.soreness != null && checkIn.soreness >= 5) {
      flags.push("pain_signal");
      reasons.push(
        "Sinal de dor intensa no check-in — não trate como ajuste de treino comum. Se a dor for aguda ou incomum, procure um profissional de saúde.",
      );
      preferLightTraining = true;
      blockStims = true;
      level = maxLevel(level, "RED");
      ruleIds.push("SAF-126");
      if (!fixedMessage) {
        fixedMessage =
          "Vamos parar este exercício por hoje. O que você descreveu merece ser avaliado por um profissional de saúde antes de voltarmos a ele. Se quiser, seguimos com exercícios que não provoquem esse desconforto. Se a dor piorar, aparecer inchaço ou você não conseguir apoiar ou mover, procure atendimento hoje.";
      }
    }
    if (checkIn.stress != null && checkIn.stress >= 5) {
      flags.push("high_stress");
      reasons.push("Estresse máximo no check-in — priorize descanso e sono.");
      preferLightTraining = true;
      level = maxLevel(level, "YELLOW");
    }
    if (
      checkIn.soreness != null &&
      checkIn.stress != null &&
      checkIn.soreness >= 4 &&
      checkIn.stress >= 4
    ) {
      // SAF-160 / D-09: not escalate_care by itself — readiness / light day.
      preferLightTraining = true;
      level = maxLevel(level, "YELLOW");
      if (!flags.includes("pain_signal") && (checkIn.soreness ?? 0) < 5) {
        reasons.push(
          "Dor e estresse elevados juntos — foque em recuperação; ajuste volume, não é emergência médica por si só.",
        );
      }
    }

    const noteMatch = matchSafetyNotes(checkIn.notes);
    if (noteMatch.ruleIds.length) {
      ruleIds.push(...noteMatch.ruleIds);
      level = maxLevel(level, noteMatch.level);
      if (noteMatch.fixedMessage) fixedMessage = noteMatch.fixedMessage;
      if (noteMatch.level === "RED" || noteMatch.level === "EMERGENCY") {
        flags.push("escalate_care");
        preferLightTraining = true;
        blockStims = true;
        reasons.push(
          "Seu check-in menciona um sinal que merece atenção profissional. Não é adaptação de treino — pause o estímulo intenso e procure avaliação adequada se os sintomas persistirem.",
        );
      }
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
    level = maxLevel(level, "YELLOW");
  }

  try {
    const snap = recovery ?? computeRecoverySnapshot(state as AppState, date);
    if (snap.readiness === "low") {
      flags.push("under_recovery");
      reasons.push(snap.explanation);
      preferLightTraining = true;
      level = maxLevel(level, "YELLOW");
      if (snap.reasonCodes.includes("sleep_low")) {
        blockStims = true;
      }
    }
  } catch {
    /* incomplete state */
  }

  const escalateCare = level === "RED" || level === "EMERGENCY";
  if (escalateCare) {
    flags.push("escalate_care");
  }
  if (blockStims) flags.push("stim_restriction");

  const blockCommerce = level !== "GREEN";

  return {
    ok: level === "GREEN" || level === "YELLOW",
    flags: [...new Set(flags)],
    reasons,
    blockStims,
    preferLightTraining,
    requireMedicalDisclaimer: true,
    escalateCare,
    date,
    level,
    ruleIds: [...new Set(ruleIds)],
    ...(fixedMessage ? { fixedMessage } : {}),
    blockCommerce,
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
