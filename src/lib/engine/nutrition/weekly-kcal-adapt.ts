/**
 * MacroFactor-light weekly kcal adaptation.
 * Single source of Δkcal for Decision → Living Plan → Coach.
 * Gates on logging completeness + kcal adherence; steps ±100/±200.
 */
import type { Goal } from "@/lib/types";
import type { ReasonCode } from "@/lib/engine/reason-codes";

export type WeeklyKcalAdaptInput = {
  goal: Goal;
  date: string;
  weightTrendKg7d: number | null;
  /** 0–1 share of days with meal logs in last 7d */
  loggingCompleteness7d: number;
  /** 0–1 mean intake/target on logged days; null if unknown */
  kcalAdherence: number | null;
  /** Average intake kcal on logged days (optional, for prose) */
  avgIntakeKcal?: number | null;
  targetKcal?: number | null;
};

export type WeeklyKcalAdaptResult = {
  delta: number;
  weekKey: string;
  confidence: number;
  reasonCodes: ReasonCode[];
  reasons: string[];
};

/** ISO week key YYYY-Www (stable for the calendar week of `date`). */
export function isoWeekKey(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function clipStep(n: number): number {
  if (n <= -150) return -200;
  if (n <= -50) return -100;
  if (n >= 150) return 200;
  if (n >= 50) return 100;
  return 0;
}

/**
 * Weekly kcal delta from weight trend + adherence gates.
 * Does not estimate TDEE — light closed-loop bias only.
 */
export function computeWeeklyKcalAdaptation(input: WeeklyKcalAdaptInput): WeeklyKcalAdaptResult {
  const weekKey = isoWeekKey(input.date);
  const reasons: string[] = [];
  const reasonCodes: ReasonCode[] = [];
  const logging = input.loggingCompleteness7d;
  const adherence = input.kcalAdherence;
  const trend = input.weightTrendKg7d;

  if (logging < 0.4) {
    return {
      delta: 0,
      weekKey,
      confidence: Math.max(0.2, logging),
      reasonCodes: ["incomplete_logging"],
      reasons: [
        `Logging incompleto (${Math.round(logging * 100)}% dos dias) — sem ajuste semanal de kcal até registrar mais refeições.`,
      ],
    };
  }

  if (adherence == null || adherence < 0.7) {
    const pct = adherence == null ? null : Math.round(adherence * 100);
    return {
      delta: 0,
      weekKey,
      confidence: 0.45,
      reasonCodes: ["adherence_gate"],
      reasons: [
        pct == null
          ? "Aderência calórica insuficiente nos dias logados — mantenha a meta atual."
          : `Aderência calórica em ${pct}% da meta — sem ajuste de kcal até chegar perto do alvo.`,
      ],
    };
  }

  let raw = 0;
  const goal = input.goal;

  if (trend != null) {
    if (goal === "gordura") {
      if (trend > 0.3) {
        raw = trend > 0.7 ? -200 : -100;
        reasonCodes.push("weight_trend_up");
        reasons.push(
          `Peso subiu ${trend.toFixed(1)} kg na semana com objetivo de emagrecer — ajuste semanal ${raw} kcal.`,
        );
      } else if (trend < -0.5 && adherence >= 0.85) {
        raw = 100;
        reasonCodes.push("weight_trend_down");
        reasons.push(
          `Peso caiu ${Math.abs(trend).toFixed(1)} kg com boa aderência — leve aumento (+100 kcal) para sustentar.`,
        );
      }
    } else if (goal === "massa") {
      if (trend < -0.3) {
        raw = trend < -0.7 ? 200 : 100;
        reasonCodes.push("weight_trend_down");
        reasons.push(
          `Peso caiu ${Math.abs(trend).toFixed(1)} kg com objetivo de massa — ajuste semanal +${raw} kcal.`,
        );
      } else if (trend > 0.7) {
        raw = -100;
        reasonCodes.push("weight_trend_up");
        reasons.push(
          `Peso subiu ${trend.toFixed(1)} kg rápido na semana de massa — ajuste semanal −100 kcal.`,
        );
      }
    } else if (goal === "performance" || goal === "saude") {
      if (trend < -0.7) {
        raw = 100;
        reasonCodes.push("weight_trend_down");
        reasons.push(
          `Peso caiu ${Math.abs(trend).toFixed(1)} kg — leve aumento (+100 kcal) para estabilidade.`,
        );
      } else if (trend > 0.7) {
        raw = -100;
        reasonCodes.push("weight_trend_up");
        reasons.push(
          `Peso subiu ${trend.toFixed(1)} kg — leve redução (−100 kcal) para estabilidade.`,
        );
      }
    }
  }

  const delta = clipStep(raw);
  if (!reasons.length) {
    reasons.push("Tendência de peso e aderência estáveis — meta de kcal mantida nesta semana.");
  }

  const confidence = Math.min(
    0.95,
    0.55 + logging * 0.2 + (adherence ?? 0) * 0.2,
  );

  return { delta, weekKey, confidence, reasonCodes, reasons };
}
