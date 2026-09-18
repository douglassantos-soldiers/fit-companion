/**
 * Deterministic WHY renderer — no LLM.
 * Turns decision type + reason codes + snapshot into Portuguese explanations.
 */
import type { ContextSnapshot } from "@/lib/engine/context-snapshot";
import { REASON_CODE_META, type ReasonCode } from "@/lib/engine/reason-codes";

export type ExplainDecisionType =
  | "training_mode"
  | "training_volume"
  | "session_duration"
  | "nutrition_calorie_delta"
  | "nutrition_protein_bias"
  | "meal_distribution"
  | "block_stims"
  | "primary_action";

function joinFragments(codes: ReasonCode[]): string {
  const frags = codes
    .filter((c) => c !== "sleep_good" && c !== "energy_high")
    .map((c) => REASON_CODE_META[c]?.fragment)
    .filter(Boolean);
  if (!frags.length) return "os dados do dia";
  if (frags.length === 1) return frags[0]!;
  if (frags.length === 2) return `${frags[0]} e ${frags[1]}`;
  return `${frags.slice(0, -1).join(", ")} e ${frags[frags.length - 1]}`;
}

export function explainWhy(
  decisionType: ExplainDecisionType,
  value: string | number | boolean,
  codes: ReasonCode[],
  _snapshot?: ContextSnapshot | null,
): string {
  const because = joinFragments(codes);

  switch (decisionType) {
    case "training_volume": {
      const pct = typeof value === "number" ? Math.round(value * 100) : value;
      if (typeof value === "number" && value < 1) {
        return `Reduzi o volume para ${pct}% porque ${because}.`;
      }
      return `Mantive o volume em ${pct}% porque ${because}.`;
    }
    case "training_mode": {
      const mode = String(value);
      if (mode === "rest") return `Priorizei descanso ativo porque ${because}.`;
      if (mode === "deload") return `Ajustei para treino leve (deload) porque ${because}.`;
      if (mode === "express") return `Encurtei a sessão (express) porque ${because}.`;
      return `Mantive treino completo porque ${because}.`;
    }
    case "session_duration":
      return `Sessão estimada em ${value} min porque ${because}.`;
    case "nutrition_calorie_delta": {
      const n = Number(value);
      if (n > 0) return `Aumentei ~${n} kcal porque ${because}.`;
      if (n < 0) return `Reduzi ~${Math.abs(n)} kcal porque ${because}.`;
      return `Mantive as calorias estáveis porque ${because}.`;
    }
    case "nutrition_protein_bias":
      return value === "up"
        ? `Priorizei proteína porque ${because}.`
        : `Mantive a meta de proteína porque ${because}.`;
    case "meal_distribution":
      return value === "rebalanced"
        ? `Reequilibrei a distribuição das refeições porque ${because}.`
        : `Mantive a distribuição padrão de refeições.`;
    case "block_stims":
      return value
        ? `Bloqueei estimulantes porque ${because}.`
        : `Stims liberados — sem restrição de segurança hoje.`;
    case "primary_action": {
      const action = String(value);
      const map: Record<string, string> = {
        train: "Treinar é a ação prioritária",
        rest: "Recuperar é a ação prioritária",
        meal: "Bater proteína é a ação prioritária",
        sleep: "Priorizar sono é a ação prioritária",
        supplement: "Suplementar no horário é a ação prioritária",
      };
      return `${map[action] ?? "Ação do dia definida"} porque ${because}.`;
    }
    default:
      return `Decisão ${decisionType}=${String(value)} porque ${because}.`;
  }
}

/** Confidence for a decision given snapshot base + converging evidence. */
export function decisionConfidence(
  snapshot: ContextSnapshot,
  codes: ReasonCode[],
): number {
  let c = snapshot.confidenceBase;
  const converging = ["sleep_low", "rpe_high", "recovery_low", "energy_low"] as ReasonCode[];
  const hits = codes.filter((code) => converging.includes(code)).length;
  if (hits >= 2) c += 0.08;
  if (hits >= 3) c += 0.05;
  if (codes.includes("time_limited") && snapshot.hasCheckInToday) c += 0.05;
  if (!snapshot.hasCheckInToday) c -= 0.05;
  return Math.round(Math.max(0.35, Math.min(0.95, c)) * 1000) / 1000;
}
