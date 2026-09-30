const COACH_SEED_KEY = "soldiers-coach-seed-q";

/** Prefill coach chat from recovery / other deep-links. */
export function seedCoachQuestion(question: string) {
  try {
    window.sessionStorage.setItem(COACH_SEED_KEY, question.slice(0, 280));
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumeCoachSeed(): string | null {
  try {
    const q = window.sessionStorage.getItem(COACH_SEED_KEY);
    if (q) window.sessionStorage.removeItem(COACH_SEED_KEY);
    return q?.trim() || null;
  } catch {
    return null;
  }
}

/** Normalize query/search `q` param into a seed question. */
export function normalizeCoachSearchSeed(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().slice(0, 280);
  return q || null;
}

/** Consume sessionStorage seed, falling back to URL search `q`. */
export function consumeCoachSeedWithSearch(searchQ: unknown): string | null {
  return consumeCoachSeed() ?? normalizeCoachSearchSeed(searchQ);
}

export function volumeRecoveryNudgeSeed(volumeDeltaPct: number | null): string {
  const delta =
    volumeDeltaPct != null
      ? `${volumeDeltaPct > 0 ? "+" : ""}${volumeDeltaPct}%`
      : "acima do usual";
  return `Meu volume ficou ${delta} na semana e a recuperação caiu. Explica o que mudou no plano e o que eu faço agora.`;
}

export function postWorkoutCoachSeed(opts?: {
  title?: string | null;
  rpe?: string | null;
}): string {
  const bits: string[] = ["Acabei de treinar"];
  if (opts?.title) bits.push(`(${opts.title})`);
  if (opts?.rpe) bits.push(`com RPE ${opts.rpe}`);
  bits.push(
    "— revisa a sessão, recuperação e o próximo passo (nutrição ou ajuste de carga).",
  );
  return bits.join(" ");
}

export function weeklyReviewCoachSeed(opts?: {
  coachLine?: string | null;
  wins?: string[];
  risks?: string[];
}): string {
  const focus = opts?.coachLine?.trim();
  const win = opts?.wins?.[0];
  const risk = opts?.risks?.[0];
  const parts = ["Faz a revisão semanal comigo."];
  if (win) parts.push(`Win: ${win}.`);
  if (risk) parts.push(`Risco: ${risk}.`);
  if (focus) parts.push(`Foco sugerido: ${focus}.`);
  parts.push("O que priorizo na próxima semana?");
  return parts.join(" ");
}

export function morningCheckinCoachSeed(line: string): string {
  return `Acabei de fazer o check-in. ${line} Explica o plano de hoje e se preciso ajustar.`;
}

export function streakRiskCoachSeed(): string {
  return "Meu streak está em risco. Monta um plano express realista para treinar hoje.";
}

export function nutritionReviewCoachSeed(opts?: {
  proteinG?: number | null;
  proteinTarget?: number | null;
  adherence7d?: number | null;
}): string {
  const parts = ["Faz a revisão de nutrição comigo."];
  if (opts?.proteinG != null && opts?.proteinTarget != null) {
    parts.push(`Hoje: ${Math.round(opts.proteinG)}/${opts.proteinTarget} g proteína.`);
  }
  if (opts?.adherence7d != null) {
    parts.push(`Aderência 7d ~${Math.round(opts.adherence7d * 100)}%.`);
  }
  parts.push("O que priorizo para fechar a meta?");
  return parts.join(" ");
}
