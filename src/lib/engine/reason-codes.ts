/**
 * Structured reason codes for Context + Decision Engine (FASE 4).
 * Engines emit codes; explainWhy renders Portuguese copy — AI does not invent rules.
 */

export const REASON_CODES = [
  "sleep_low",
  "sleep_good",
  "energy_low",
  "energy_high",
  "rpe_high",
  "recovery_low",
  "protein_low",
  "weight_trend_down",
  "time_limited",
  "travel",
  "equipment_limited",
  "adherence_drop",
  "stim_restriction",
  "deload_week",
  "restock_risk",
  "escalate_care",
  "pain_signal",
  "high_stress",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_CODE_META: Record<
  ReasonCode,
  { label: string; fragment: string; direction: "up" | "down" | "stable" | "risk" }
> = {
  sleep_low: {
    label: "Sono baixo",
    fragment: "seu sono caiu",
    direction: "down",
  },
  sleep_good: {
    label: "Sono bom",
    fragment: "seu sono está bom",
    direction: "up",
  },
  energy_low: {
    label: "Energia baixa",
    fragment: "sua energia está baixa",
    direction: "down",
  },
  energy_high: {
    label: "Energia alta",
    fragment: "sua energia está alta",
    direction: "up",
  },
  rpe_high: {
    label: "RPE elevado",
    fragment: "seu RPE permaneceu elevado",
    direction: "risk",
  },
  recovery_low: {
    label: "Recuperação baixa",
    fragment: "sua recuperação está baixa",
    direction: "down",
  },
  protein_low: {
    label: "Proteína baixa",
    fragment: "a proteína ficou abaixo da meta",
    direction: "down",
  },
  weight_trend_down: {
    label: "Peso em queda",
    fragment: "o peso caiu na última semana",
    direction: "down",
  },
  time_limited: {
    label: "Pouco tempo",
    fragment: "você tem pouco tempo disponível",
    direction: "risk",
  },
  travel: {
    label: "Viagem",
    fragment: "você está em contexto de viagem",
    direction: "risk",
  },
  equipment_limited: {
    label: "Equipamento limitado",
    fragment: "o equipamento está limitado hoje",
    direction: "risk",
  },
  adherence_drop: {
    label: "Aderência em queda",
    fragment: "a aderência caiu recentemente",
    direction: "down",
  },
  stim_restriction: {
    label: "Stims bloqueados",
    fragment: "estimulantes foram restringidos",
    direction: "risk",
  },
  deload_week: {
    label: "Semana deload",
    fragment: "a semana aponta para deload",
    direction: "risk",
  },
  restock_risk: {
    label: "Risco de reposição",
    fragment: "há risco de acabar suplemento",
    direction: "risk",
  },
  escalate_care: {
    label: "Atenção profissional",
    fragment: "há um sinal que merece atenção profissional",
    direction: "risk",
  },
  pain_signal: {
    label: "Sinal de dor",
    fragment: "há um sinal de dor intensa",
    direction: "risk",
  },
  high_stress: {
    label: "Estresse alto",
    fragment: "seu estresse está no máximo",
    direction: "risk",
  },
};

export function isReasonCode(raw: string): raw is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(raw);
}

/** Map Safety Engine flags → reason codes. */
export function reasonCodesFromSafetyFlags(
  flags: Array<string>,
): ReasonCode[] {
  const out: ReasonCode[] = [];
  for (const f of flags) {
    if (f === "low_sleep") out.push("sleep_low");
    if (f === "high_fatigue") out.push("energy_low");
    if (f === "hard_rpe_streak") out.push("rpe_high");
    if (f === "stim_restriction") out.push("stim_restriction");
    if (f === "under_recovery") out.push("recovery_low");
    if (f === "escalate_care") out.push("escalate_care");
    if (f === "pain_signal") out.push("pain_signal");
    if (f === "high_stress") out.push("high_stress");
  }
  return [...new Set(out)];
}

const TRAVEL_RE = /\b(viagem|travel|hotel|aeroporto|trip)\b/i;

export function detectTravelFromNotes(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return TRAVEL_RE.test(notes);
}
