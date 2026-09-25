/**
 * Structured reason codes for Context + Decision Engine (FASE 4).
 * Engines emit codes; explainWhy renders Portuguese copy — AI does not invent rules.
 * SoT remains snake_case; SCREAMING aliases are for Coach / Why UI only.
 */

/** Bump when adding/removing codes or changing alias map semantics. */
export const REASON_CODES_VERSION = 2;

export const REASON_CODES = [
  "sleep_low",
  "sleep_good",
  "energy_low",
  "energy_high",
  "rpe_high",
  "recovery_low",
  "protein_low",
  "weight_trend_down",
  "weight_trend_up",
  "time_limited",
  "travel",
  "equipment_limited",
  "adherence_drop",
  "adherence_gate",
  "incomplete_logging",
  "stim_restriction",
  "deload_week",
  "restock_risk",
  "escalate_care",
  "pain_signal",
  "high_stress",
  "plateau_detected",
  "progression_ready",
  "low_muscle_fatigue",
  "excessive_muscle_load",
  "undertrained_muscle",
  "pr_opportunity",
  "nutrition_adherence_low",
  "weekend_adherence_pattern",
  "express_high_adherence",
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
  weight_trend_up: {
    label: "Peso em alta",
    fragment: "o peso subiu na última semana",
    direction: "up",
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
  adherence_gate: {
    label: "Aderência insuficiente",
    fragment: "a aderência calórica ainda não sustenta um ajuste",
    direction: "risk",
  },
  incomplete_logging: {
    label: "Logging incompleto",
    fragment: "o registro de refeições está incompleto",
    direction: "risk",
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
    label: "Estoque estimado baixo",
    fragment: "o estoque estimado de suplemento está chegando ao fim",
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
  plateau_detected: {
    label: "Plateau",
    fragment: "há plateau em exercícios-chave",
    direction: "risk",
  },
  progression_ready: {
    label: "Pronto para progressão",
    fragment: "há espaço para progressão de carga",
    direction: "up",
  },
  low_muscle_fatigue: {
    label: "Baixa fadiga muscular",
    fragment: "a fadiga muscular está baixa",
    direction: "up",
  },
  excessive_muscle_load: {
    label: "Carga muscular alta",
    fragment: "a carga muscular recente está elevada",
    direction: "risk",
  },
  undertrained_muscle: {
    label: "Músculo subtreinados",
    fragment: "há grupos musculares pouco estimulados",
    direction: "risk",
  },
  pr_opportunity: {
    label: "Oportunidade de PR",
    fragment: "há oportunidade de PR próximo",
    direction: "up",
  },
  nutrition_adherence_low: {
    label: "Aderência nutricional baixa",
    fragment: "a aderência nutricional está baixa",
    direction: "down",
  },
  weekend_adherence_pattern: {
    label: "Padrão de fim de semana",
    fragment: "há um padrão de queda no fim de semana",
    direction: "risk",
  },
  express_high_adherence: {
    label: "Express com alta aderência",
    fragment: "treinos curtos têm alta aderência para você",
    direction: "up",
  },
};

/** SCREAMING aliases for docs / Coach / Why panel (SoT remains snake_case). */
export const REASON_CODE_ALIASES: Record<string, ReasonCode> = {
  LOW_SLEEP: "sleep_low",
  HIGH_SLEEP: "sleep_good",
  HIGH_RECOVERY: "sleep_good",
  RECOVERY_IMPROVED: "low_muscle_fatigue",
  HIGH_FATIGUE: "energy_low",
  ENERGY_LOW: "energy_low",
  ENERGY_HIGH: "energy_high",
  HIGH_RPE_STREAK: "rpe_high",
  LOW_RECOVERY: "recovery_low",
  HIGH_RECOVERY_LOAD: "recovery_low",
  HIGH_TRAINING_LOAD: "excessive_muscle_load",
  LIMITED_TIME: "time_limited",
  SHORT_AVAILABLE_TIME: "time_limited",
  NO_EQUIPMENT: "equipment_limited",
  TRAINING_PROGRESS: "progression_ready",
  PROGRESSION_READY: "progression_ready",
  PLATEAU: "plateau_detected",
  PLATEAU_DETECTED: "plateau_detected",
  NUTRITION_ADHERENCE: "protein_low",
  LOW_NUTRITION_ADHERENCE: "nutrition_adherence_low",
  LOW_ADHERENCE: "adherence_drop",
  ADHERENCE_DROP: "adherence_drop",
  WEEKEND_ADHERENCE_PATTERN: "weekend_adherence_pattern",
  EXPRESS_HIGH_ADHERENCE: "express_high_adherence",
  REST_DAY: "deload_week",
  DELOAD_WEEK: "deload_week",
  MUSCLE_FATIGUE: "excessive_muscle_load",
  MUSCLE_UNDERTRAINED: "undertrained_muscle",
  TRAVEL: "travel",
  PAIN_SIGNAL: "pain_signal",
  ESCALATE_CARE: "escalate_care",
  STIM_RESTRICTION: "stim_restriction",
};

export function isReasonCode(raw: string): raw is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(raw);
}

/** Prefer snake SoT; resolve SCREAMING alias when needed. */
export function canonicalReasonCode(raw: string): ReasonCode {
  if (isReasonCode(raw)) return raw;
  const aliased = REASON_CODE_ALIASES[raw] ?? REASON_CODE_ALIASES[raw.toUpperCase()];
  if (aliased) return aliased;
  return raw as ReasonCode;
}

/** Map snake → preferred SCREAMING alias for explain UI. */
export function toReasonAlias(code: ReasonCode): string {
  const preferred: Partial<Record<ReasonCode, string>> = {
    sleep_low: "LOW_SLEEP",
    sleep_good: "HIGH_SLEEP",
    energy_low: "HIGH_FATIGUE",
    energy_high: "ENERGY_HIGH",
    rpe_high: "HIGH_RPE_STREAK",
    recovery_low: "LOW_RECOVERY",
    time_limited: "LIMITED_TIME",
    equipment_limited: "NO_EQUIPMENT",
    progression_ready: "TRAINING_PROGRESS",
    plateau_detected: "PLATEAU",
    protein_low: "NUTRITION_ADHERENCE",
    nutrition_adherence_low: "LOW_NUTRITION_ADHERENCE",
    adherence_drop: "LOW_ADHERENCE",
    excessive_muscle_load: "HIGH_TRAINING_LOAD",
    low_muscle_fatigue: "RECOVERY_IMPROVED",
    deload_week: "REST_DAY",
    travel: "TRAVEL",
    pain_signal: "PAIN_SIGNAL",
    escalate_care: "ESCALATE_CARE",
    stim_restriction: "STIM_RESTRICTION",
  };
  return preferred[code] ?? code.toUpperCase();
}

/** Map Safety Engine flags → reason codes. */
export function reasonCodesFromSafetyFlags(flags: Array<string>): ReasonCode[] {
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
